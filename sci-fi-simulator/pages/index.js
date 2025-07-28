import Link from "next/link";
import "../styles/index.css"; // Import page-specific styles

export default function HomePage() {
  return (
    <div className="container">
      <div className="overlay"></div>
      <div className="content">
        <h1>Instrumented Battle Training System</h1>
        <div className="buttons">
          <button className="btn" onClick={() => (window.location.href = "/terrain")}>
            New Exercise 
          </button>
          <button className="btn" onClick={() => (window.location.href = "/aar")}>
         View Previous Excercise
          </button>
          
          <button className="btn" onClick={() => (window.location.href = "/adddetails")}>
          Add Entity to Database
          </button>
          
          <button className="btn" onClick={() => (window.location.href = "/se")}>
          SETTING ⚙️
          </button>
        </div>
        </div>
        <div className="footer">© 2024 Mechphy Defense Systems. All rights reserved.</div>
        <div className="version">v2.5.7</div>
    </div>
  );
}

