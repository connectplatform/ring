"use strict";(self.webpackChunkring_docs=self.webpackChunkring_docs||[]).push([[7636],{2123:(e,t,n)=>{n.r(t),n.d(t,{assets:()=>l,contentTitle:()=>o,default:()=>h,frontMatter:()=>a,metadata:()=>s,toc:()=>d});const s=JSON.parse('{"id":"api/ensure-wallet","title":"Wallet Creation API","description":"This API endpoint allows you to create a new wallet for a user or retrieve an existing wallet address. It ensures that each user has a unique wallet associated with their account.","source":"@site/docs/api/ensure-wallet.md","sourceDirName":"api","slug":"/api/ensure-wallet","permalink":"/ring/docs/api/ensure-wallet","draft":false,"unlisted":false,"editUrl":"https://github.com/connectplatform/ring/ring-docs/tree/main/docs/api/ensure-wallet.md","tags":[],"version":"current","lastUpdatedAt":1733486397000,"sidebarPosition":2,"frontMatter":{"sidebar_position":2},"sidebar":"apiSidebar","previous":{"title":"Wallet Transfer API","permalink":"/ring/docs/api/wallet-transfer"},"next":{"title":"List User Wallets API","permalink":"/ring/docs/api/wallet-list"}}');var i=n(4848),r=n(8453);const a={sidebar_position:2},o="Wallet Creation API",l={},d=[{value:"Endpoint",id:"endpoint",level:2},{value:"Authentication",id:"authentication",level:2},{value:"Request Body",id:"request-body",level:2},{value:"Response",id:"response",level:2},{value:"Error Responses",id:"error-responses",level:2}];function c(e){const t={admonition:"admonition",code:"code",h1:"h1",h2:"h2",header:"header",li:"li",ol:"ol",p:"p",pre:"pre",...(0,r.R)(),...e.components};return(0,i.jsxs)(i.Fragment,{children:[(0,i.jsx)(t.header,{children:(0,i.jsx)(t.h1,{id:"wallet-creation-api",children:"Wallet Creation API"})}),"\n",(0,i.jsx)(t.p,{children:"This API endpoint allows you to create a new wallet for a user or retrieve an existing wallet address. It ensures that each user has a unique wallet associated with their account."}),"\n",(0,i.jsx)(t.h2,{id:"endpoint",children:"Endpoint"}),"\n",(0,i.jsxs)(t.p,{children:[(0,i.jsx)("span",{class:"api-method api-method--post",children:"POST"})," ",(0,i.jsx)(t.code,{children:"/api/wallet/ensure"})]}),"\n",(0,i.jsx)(t.h2,{id:"authentication",children:"Authentication"}),"\n",(0,i.jsx)(t.p,{children:"This endpoint requires authentication. Ensure that the user is logged in and has a valid session."}),"\n",(0,i.jsx)(t.h2,{id:"request-body",children:"Request Body"}),"\n",(0,i.jsx)(t.p,{children:"This endpoint does not require a request body. The user's ID is obtained from the authenticated session."}),"\n",(0,i.jsx)(t.h2,{id:"response",children:"Response"}),"\n",(0,i.jsx)(t.p,{children:"The API returns a JSON object with the following structure:"}),"\n",(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-typescript",children:"{\n  address: string;\n}\n"})}),"\n",(0,i.jsxs)(t.p,{children:["Where ",(0,i.jsx)(t.code,{children:"address"})," is the Ethereum wallet address associated with the user."]}),"\n",(0,i.jsxs)(t.admonition,{title:"Usage Example",type:"tip",children:[(0,i.jsx)(t.p,{children:"Create or retrieve a wallet for the authenticated user:"}),(0,i.jsx)(t.pre,{children:(0,i.jsx)(t.code,{className:"language-javascript",children:"const response = await fetch('/api/wallet/ensure', {\n  method: 'POST',\n  headers: {\n    'Content-Type': 'application/json',\n  },\n});\nconst data = await response.json();\nconsole.log(data.address); // The user's wallet address\n"})})]}),"\n",(0,i.jsx)(t.h2,{id:"error-responses",children:"Error Responses"}),"\n",(0,i.jsx)(t.admonition,{title:"Implementation Details",type:"note",children:(0,i.jsxs)(t.ol,{children:["\n",(0,i.jsx)(t.li,{children:"The endpoint first checks if the user already has a wallet address stored in the database."}),"\n",(0,i.jsx)(t.li,{children:"If a wallet exists, it returns the existing address without creating a new one."}),"\n",(0,i.jsx)(t.li,{children:"If no wallet exists, it creates a new random wallet using ethers.js."}),"\n",(0,i.jsx)(t.li,{children:"The new wallet address and encrypted private key are stored in the user's document in the database."}),"\n",(0,i.jsx)(t.li,{children:"The wallet address is then returned to the client."}),"\n"]})}),"\n",(0,i.jsx)(t.admonition,{title:"Security Note",type:"caution",children:(0,i.jsx)(t.p,{children:"In the provided implementation, the private key is stored unencrypted for demonstration purposes. In a production environment, you MUST use a secure method to encrypt the private key before storing it in the database."})}),"\n",(0,i.jsx)(t.admonition,{title:"Best Practices",type:"info",children:(0,i.jsxs)(t.ol,{children:["\n",(0,i.jsx)(t.li,{children:"Implement proper error handling in your client-side code to manage potential API errors."}),"\n",(0,i.jsx)(t.li,{children:"Consider implementing rate limiting to prevent abuse of this endpoint."}),"\n",(0,i.jsx)(t.li,{children:"Ensure that your database has appropriate access controls and encryption at rest to protect sensitive wallet information."}),"\n",(0,i.jsx)(t.li,{children:"Regularly audit and rotate encryption keys used for securing private keys."}),"\n"]})}),"\n",(0,i.jsx)(t.admonition,{title:"Limitations",type:"warning",children:(0,i.jsxs)(t.ol,{children:["\n",(0,i.jsx)(t.li,{children:"This API currently creates Ethereum-compatible wallets only."}),"\n",(0,i.jsx)(t.li,{children:"The wallet creation process is synchronous and may impact response times for users with slow connections."}),"\n"]})}),"\n",(0,i.jsx)(t.p,{children:"Stay tuned for updates and feel free to provide feedback for improvements!"})]})}function h(e={}){const{wrapper:t}={...(0,r.R)(),...e.components};return t?(0,i.jsx)(t,{...e,children:(0,i.jsx)(c,{...e})}):c(e)}},8453:(e,t,n)=>{n.d(t,{R:()=>a,x:()=>o});var s=n(6540);const i={},r=s.createContext(i);function a(e){const t=s.useContext(r);return s.useMemo((function(){return"function"==typeof e?e(t):{...t,...e}}),[t,e])}function o(e){let t;return t=e.disableParentContext?"function"==typeof e.components?e.components(i):e.components||i:a(e.components),s.createElement(r.Provider,{value:t},e.children)}}}]);