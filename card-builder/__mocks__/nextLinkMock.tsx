import React from "react";

type LinkProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export default function Link({ href, children, className }: LinkProps) {
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}
