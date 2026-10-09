"use client";

import dynamic from "next/dynamic";

// The editor seeds its state from localStorage (drafts, paper), so it only renders in the browser.
const Write = dynamic(() => import("@/pages/Write"), { ssr: false });

export default Write;
