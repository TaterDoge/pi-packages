import { render } from "solid-js/web";
import App from "./App";
import { applyTheme, initialTheme } from "./lib/theme";
import "./styles.css";

applyTheme(initialTheme());

const root = document.getElementById("root");
if (!root) throw new Error("Missing root element.");

render(() => <App />, root);
