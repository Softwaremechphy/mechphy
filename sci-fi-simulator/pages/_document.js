// pages/_document.js
import Document, { Html, Head, Main, NextScript } from 'next/document';

class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* Leaflet CSS */}
          <link rel="stylesheet" href="/leaflet/leaflet.css" />
          {/* Leaflet JS - Synchronous loading */}
          <script src="/leaflet/leaflet.js"></script>
          {/* SQL.js - Synchronous loading */}
          <script src="/sqljs/sql-wasm.js"></script>
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;