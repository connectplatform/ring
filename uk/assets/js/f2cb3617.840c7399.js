"use strict";(self.webpackChunkring_docs=self.webpackChunkring_docs||[]).push([[8287],{302:(e,n,t)=>{t.r(n),t.d(n,{assets:()=>l,contentTitle:()=>o,default:()=>h,frontMatter:()=>a,metadata:()=>i,toc:()=>c});const i=JSON.parse('{"id":"api/transaction-history","title":"Transaction History API","description":"This API endpoint allows you to retrieve the transaction history for a user\'s wallet address. It supports pagination, filtering, and provides detailed transaction information.","source":"@site/docs/api/transaction-history.md","sourceDirName":"api","slug":"/api/transaction-history","permalink":"/ring/uk/docs/api/transaction-history","draft":false,"unlisted":false,"editUrl":"https://github.com/connectplatform/ring/ring-docs/tree/main/docs/api/transaction-history.md","tags":[],"version":"current","lastUpdatedAt":1733486397000,"sidebarPosition":1,"frontMatter":{"sidebar_position":1},"sidebar":"tutorialSidebar","previous":{"title":"Translate your site","permalink":"/ring/uk/docs/tutorial-extras/translate-your-site"},"next":{"title":"Wallet Creation API","permalink":"/ring/uk/docs/api/ensure-wallet"}}');var r=t(4848),s=t(8453);const a={sidebar_position:1},o="Transaction History API",l={},c=[{value:"Endpoint",id:"endpoint",level:2},{value:"Authentication",id:"authentication",level:2},{value:"Query Parameters",id:"query-parameters",level:2},{value:"Response",id:"response",level:2},{value:"Pagination",id:"pagination",level:3},{value:"Filtering",id:"filtering",level:3},{value:"Error Responses",id:"error-responses",level:2}];function d(e){const n={admonition:"admonition",code:"code",h1:"h1",h2:"h2",h3:"h3",header:"header",li:"li",ol:"ol",p:"p",pre:"pre",table:"table",tbody:"tbody",td:"td",th:"th",thead:"thead",tr:"tr",...(0,s.R)(),...e.components};return(0,r.jsxs)(r.Fragment,{children:[(0,r.jsx)(n.header,{children:(0,r.jsx)(n.h1,{id:"transaction-history-api",children:"Transaction History API"})}),"\n",(0,r.jsx)(n.p,{children:"This API endpoint allows you to retrieve the transaction history for a user's wallet address. It supports pagination, filtering, and provides detailed transaction information."}),"\n",(0,r.jsx)(n.h2,{id:"endpoint",children:"Endpoint"}),"\n",(0,r.jsxs)(n.p,{children:[(0,r.jsx)("span",{class:"api-method api-method--get",children:"GET"})," ",(0,r.jsx)(n.code,{children:"/api/wallet/history"})]}),"\n",(0,r.jsx)(n.h2,{id:"authentication",children:"Authentication"}),"\n",(0,r.jsx)(n.p,{children:"This endpoint requires authentication. Ensure that the user is logged in and has a valid session."}),"\n",(0,r.jsx)(n.h2,{id:"query-parameters",children:"Query Parameters"}),"\n",(0,r.jsx)("div",{class:"custom-table",children:(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Parameter"}),(0,r.jsx)(n.th,{children:"Type"}),(0,r.jsx)(n.th,{children:"Description"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"page"}),(0,r.jsx)(n.td,{children:"number"}),(0,r.jsx)(n.td,{children:"The page number for pagination. Default is 1."})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"pageSize"}),(0,r.jsx)(n.td,{children:"number"}),(0,r.jsx)(n.td,{children:"The number of transactions per page. Default is 10."})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"startBlock"}),(0,r.jsx)(n.td,{children:"number"}),(0,r.jsx)(n.td,{children:"(Optional) The starting block number to fetch transactions from."})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"endBlock"}),(0,r.jsx)(n.td,{children:"number"}),(0,r.jsx)(n.td,{children:"(Optional) The ending block number to fetch transactions to."})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"type"}),(0,r.jsx)(n.td,{children:"string"}),(0,r.jsx)(n.td,{children:"(Optional) Filter by transaction type."})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"minAmount"}),(0,r.jsx)(n.td,{children:"string"}),(0,r.jsx)(n.td,{children:"(Optional) Filter by minimum transaction amount (in ETH)."})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"maxAmount"}),(0,r.jsx)(n.td,{children:"string"}),(0,r.jsx)(n.td,{children:"(Optional) Filter by maximum transaction amount (in ETH)."})]})]})]})}),"\n",(0,r.jsx)(n.h2,{id:"response",children:"Response"}),"\n",(0,r.jsx)(n.p,{children:"The API returns a JSON object with the following structure:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-typescript",children:"{\n  history: Array<{\n    hash: string;\n    from: string;\n    to: string | null;\n    value: string;\n    gasPrice: string | null;\n    gasLimit: string | undefined;\n    gasUsed: string | undefined;\n    timestamp: number;\n    status: 'Success' | 'Failed';\n    type: number;\n    contractInteraction: boolean;\n  }>;\n  pagination: {\n    page: number;\n    pageSize: number;\n    totalPages: number;\n    totalItems: number;\n  };\n}\n"})}),"\n",(0,r.jsxs)(n.admonition,{title:"Usage Example",type:"tip",children:[(0,r.jsx)(n.p,{children:"Fetch the first page of transaction history:"}),(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-javascript",children:"const response = await fetch('/api/wallet/history');\nconst data = await response.json();\n"})})]}),"\n",(0,r.jsx)(n.h3,{id:"pagination",children:"Pagination"}),"\n",(0,r.jsx)(n.p,{children:"Fetch the second page with 20 items per page:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-javascript",children:"const response = await fetch('/api/wallet/history?page=2&pageSize=20');\nconst data = await response.json();\n"})}),"\n",(0,r.jsx)(n.h3,{id:"filtering",children:"Filtering"}),"\n",(0,r.jsx)(n.p,{children:"Fetch transactions within a specific block range:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-javascript",children:"const response = await fetch('/api/wallet/history?startBlock=1000000&endBlock=2000000');\nconst data = await response.json();\n"})}),"\n",(0,r.jsx)(n.p,{children:"Filter transactions by type and amount:"}),"\n",(0,r.jsx)(n.pre,{children:(0,r.jsx)(n.code,{className:"language-javascript",children:"const response = await fetch('/api/wallet/history?type=2&minAmount=0.1&maxAmount=1.0');\nconst data = await response.json();\n"})}),"\n",(0,r.jsx)(n.h2,{id:"error-responses",children:"Error Responses"}),"\n",(0,r.jsx)("div",{class:"custom-table",children:(0,r.jsxs)(n.table,{children:[(0,r.jsx)(n.thead,{children:(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.th,{children:"Status Code"}),(0,r.jsx)(n.th,{children:"Description"})]})}),(0,r.jsxs)(n.tbody,{children:[(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"401"}),(0,r.jsx)(n.td,{children:"Unauthorized - User is not authenticated"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"404"}),(0,r.jsx)(n.td,{children:"Not Found - User wallet not found"})]}),(0,r.jsxs)(n.tr,{children:[(0,r.jsx)(n.td,{children:"500"}),(0,r.jsx)(n.td,{children:"Internal Server Error - Failed to fetch transaction history"})]})]})]})}),"\n",(0,r.jsx)(n.admonition,{title:"Usage Notes",type:"note",children:(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsx)(n.li,{children:"The API caches recent transaction history for 5 minutes to reduce blockchain queries."}),"\n",(0,r.jsx)(n.li,{children:"The maximum number of blocks that can be queried in a single request is limited to 1000 for performance reasons."}),"\n",(0,r.jsxs)(n.li,{children:["If ",(0,r.jsx)(n.code,{children:"startBlock"})," and ",(0,r.jsx)(n.code,{children:"endBlock"})," are not provided, the API will fetch the most recent 1000 blocks."]}),"\n",(0,r.jsx)(n.li,{children:"Transaction amounts are returned in ETH, not Wei."}),"\n",(0,r.jsxs)(n.li,{children:["The ",(0,r.jsx)(n.code,{children:"contractInteraction"})," field indicates whether the transaction involved interaction with a smart contract."]}),"\n"]})}),"\n",(0,r.jsx)(n.admonition,{title:"Best Practices",type:"info",children:(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsx)(n.li,{children:"Use pagination to improve performance and reduce load times for users."}),"\n",(0,r.jsx)(n.li,{children:"Implement error handling in your client-side code to gracefully handle API errors."}),"\n",(0,r.jsx)(n.li,{children:"Consider implementing client-side caching to further reduce API calls for frequently accessed data."}),"\n",(0,r.jsx)(n.li,{children:"When filtering by date, use block numbers instead of timestamps for more accurate results."}),"\n"]})}),"\n",(0,r.jsx)(n.admonition,{title:"Limitations",type:"caution",children:(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsx)(n.li,{children:"The API currently only supports Ethereum and Polygon networks."}),"\n",(0,r.jsx)(n.li,{children:"Historical data beyond 1000 blocks may require multiple API calls."}),"\n",(0,r.jsx)(n.li,{children:"The accuracy of gas prices and transaction status depends on the underlying blockchain provider."}),"\n"]})}),"\n",(0,r.jsxs)(n.admonition,{title:"Future Enhancements",type:"tip",children:[(0,r.jsx)(n.p,{children:"We are planning to add the following features in future updates:"}),(0,r.jsxs)(n.ol,{children:["\n",(0,r.jsx)(n.li,{children:"Support for multiple blockchain networks"}),"\n",(0,r.jsx)(n.li,{children:"Webhook notifications for new transactions"}),"\n",(0,r.jsx)(n.li,{children:"Enhanced filtering options (e.g., by token type for ERC-20 and ERC-721 transactions)"}),"\n",(0,r.jsx)(n.li,{children:"Aggregated statistics for wallet activity"}),"\n"]})]}),"\n",(0,r.jsx)(n.p,{children:"Stay tuned for updates and feel free to provide feedback for improvements!"})]})}function h(e={}){const{wrapper:n}={...(0,s.R)(),...e.components};return n?(0,r.jsx)(n,{...e,children:(0,r.jsx)(d,{...e})}):d(e)}},8453:(e,n,t)=>{t.d(n,{R:()=>a,x:()=>o});var i=t(6540);const r={},s=i.createContext(r);function a(e){const n=i.useContext(s);return i.useMemo((function(){return"function"==typeof e?e(n):{...n,...e}}),[n,e])}function o(e){let n;return n=e.disableParentContext?"function"==typeof e.components?e.components(r):e.components||r:a(e.components),i.createElement(s.Provider,{value:n},e.children)}}}]);