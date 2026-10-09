import { Suspense } from "react";
import AuthPage from "@/pages/AuthPage";

export default function Page() {
  return <Suspense><AuthPage /></Suspense>;
}
