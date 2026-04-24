"use client";

import dynamic from "next/dynamic";

const ClientMapPage = dynamic(() => import("../../components/ClientMapPage"), {
  ssr: false,
});

export default function MapPage() {
  return <ClientMapPage />;
}