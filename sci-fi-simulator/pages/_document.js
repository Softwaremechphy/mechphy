// pages/_document.js
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
       <linl rel='stylesheet' href='/leaflet/leaflet.css' />
       <script src="/leaflet/leaflet.js" defer></script>
       <script src ="/sqljs/sql-wasm.js" defer></script>
      </Head>

      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
