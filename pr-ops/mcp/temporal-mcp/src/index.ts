import express from 'express';
import { Connection, Client } from '@temporalio/client';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const port = Number(process.env.PORT || 3300);
const temporalAddress = process.env.TEMPORAL_ADDRESS || 'temporal-frontend.pr-ops.svc.cluster.local:7233';
const temporalNamespace = process.env.TEMPORAL_NAMESPACE || 'pr-ops';

let clientPromise: Promise<Client> | undefined;
async function temporalClient() {
  if (!clientPromise) {
    clientPromise = Connection.connect({ address: temporalAddress }).then(
      (connection) => new Client({ connection, namespace: temporalNamespace })
    );
  }
  return clientPromise;
}

function asContent(value: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }] };
}

function createServer() {
  const server = new McpServer(
    { name: 'temporal-workflows', version: '0.1.1' },
    {
      instructions:
        'Use Temporal tools to start PR workflows, send human approval signals, query workflow status, and list active workflow executions.'
    }
  );

  server.registerTool(
    'temporal_trigger_workflow',
    {
      title: 'Trigger Temporal Workflow',
      description: 'Start a workflow execution in namespace pr-ops.',
      inputSchema: {
        workflowType: z.string(),
        taskQueue: z.string(),
        workflowId: z.string(),
        input: z.unknown().optional()
      }
    },
    async ({ workflowType, taskQueue, workflowId, input }) => {
      const client = await temporalClient();
      const handle = await client.workflow.start(workflowType, {
        taskQueue,
        workflowId,
        args: input === undefined ? [] : [input]
      });
      return asContent({ workflowId: handle.workflowId, firstExecutionRunId: handle.firstExecutionRunId });
    }
  );

  server.registerTool(
    'temporal_send_signal',
    {
      title: 'Send Temporal Signal',
      description: 'Send a signal to an existing workflow execution.',
      inputSchema: {
        workflowId: z.string(),
        signalName: z.string(),
        payload: z.unknown().optional()
      }
    },
    async ({ workflowId, signalName, payload }) => {
      const client = await temporalClient();
      const handle = client.workflow.getHandle(workflowId);
      await handle.signal(signalName, payload);
      return asContent({ workflowId, signalName, sent: true });
    }
  );

  server.registerTool(
    'temporal_query_status',
    {
      title: 'Query Temporal Workflow Status',
      description: 'Describe one workflow execution.',
      inputSchema: {
        workflowId: z.string()
      }
    },
    async ({ workflowId }) => {
      const client = await temporalClient();
      const handle = client.workflow.getHandle(workflowId);
      return asContent(await handle.describe());
    }
  );

  server.registerTool(
    'temporal_pause_all_content',
    {
      title: 'Pause All Content',
      description: 'Signal a supervisor workflow to pause all PR content work.',
      inputSchema: {
        reason: z.string()
      }
    },
    async ({ reason }) => {
      const client = await temporalClient();
      const handle = client.workflow.getHandle('pr-ops-supervisor');
      await handle.signal('PAUSE_ALL', { reason, at: new Date().toISOString() });
      return asContent({ supervisorWorkflowId: 'pr-ops-supervisor', signalName: 'PAUSE_ALL', reason });
    }
  );

  server.registerTool(
    'temporal_list_running',
    {
      title: 'List Running Temporal Workflows',
      description: 'List running workflow executions, optionally filtered by workflow type.',
      inputSchema: {
        workflowType: z.string().optional()
      }
    },
    async ({ workflowType }) => {
      const client = await temporalClient();
      const query = workflowType
        ? `ExecutionStatus = "Running" AND WorkflowType = "${workflowType}"`
        : 'ExecutionStatus = "Running"';
      const executions = [];
      for await (const execution of client.workflow.list({ query })) {
        executions.push(execution);
        if (executions.length >= 50) break;
      }
      return asContent({ query, executions });
    }
  );

  return server;
}

const app = express();
app.use(express.json({ limit: '2mb' }));
app.get('/health', async (_req, res) => {
  try {
    await temporalClient();
    res.json({ status: 'ok', service: 'temporal-mcp', temporalAddress, temporalNamespace });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error instanceof Error ? error.message : String(error) });
  }
});
app.post('/mcp', async (req, res) => {
  try {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
    }
  }
});

app.listen(port, () => {
  console.log(`temporal-mcp listening on :${port}; Temporal ${temporalAddress}/${temporalNamespace}`);
});
