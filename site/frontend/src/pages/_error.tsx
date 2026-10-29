import React from "react";
import type { NextPageContext } from "next";
import ServerFallbackPage from "./500";
import NotFoundPage from "./404";

type ErrorProps = {
  statusCode?: number;
};

export default function ErrorPage(props: ErrorProps) {
  if (props.statusCode === 404) return <NotFoundPage />;
  return <ServerFallbackPage />;
}

ErrorPage.getInitialProps = ({ res, err }: NextPageContext): ErrorProps => {
  const statusCode = res?.statusCode || err?.statusCode || 500;
  return { statusCode };
};
