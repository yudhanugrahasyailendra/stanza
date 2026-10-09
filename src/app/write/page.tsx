import { Suspense } from "react";
import WriteClient from "./WriteClient";

export default function Page() {
  return <Suspense><WriteClient /></Suspense>;
}
