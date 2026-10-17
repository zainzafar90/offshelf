import { createRoot } from "react-dom/client";
import { LibraryPage } from "../../src/surfaces/library/library-page";
import { Toaster } from "../../src/surfaces/shared/toast";
import "../../src/styles/globals.css";

const root = document.getElementById("app")!;

createRoot(root).render(
  <>
    <LibraryPage />
    <Toaster />
  </>,
);
