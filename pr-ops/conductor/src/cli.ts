const conductorUrl = (process.env.CONDUCTOR_URL || 'http://conductor-gateway.pr-ops.svc.cluster.local:4000').replace(/\/$/, '');

function arg(name: string, fallback = '') {
  const prefix = `--${name}=`;
  const found = process.argv.find((value) => value.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

async function main() {
  const mode = arg('mode', 'route');
  const inputType = arg('input-type', 'auto_classify');
  const content = arg('content', '');
  const metadataRaw = arg('metadata', '{}');

  let metadata: unknown = {};
  try {
    metadata = JSON.parse(metadataRaw);
  } catch {
    metadata = { raw: metadataRaw };
  }

  const endpoint = mode === 'boss' ? '/boss' : '/route';
  const body =
    mode === 'boss'
      ? { message: content, metadata }
      : {
          input_type: inputType,
          content,
          metadata
        };

  const response = await fetch(`${conductorUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  console.log(text);
  if (!response.ok) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
