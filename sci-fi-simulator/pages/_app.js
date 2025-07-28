import "../styles/globals.css"; // Import global CSS
import { GlobalProvider } from "../context/GlobalContext";

export default function MyApp({ Component, pageProps }) {
  return (
    <GlobalProvider>
      <Component {...pageProps} />
    </GlobalProvider>
  );
}
