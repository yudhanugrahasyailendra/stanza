import { Suspense } from "react";
import AuthPage from "@/views/AuthPage";

export default function Page() {
  return <Suspense><AuthPage /></Suspense>;
}
