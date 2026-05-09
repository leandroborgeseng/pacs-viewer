export default function ViewerLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[min(100%-0.5rem,1680px)] -translate-x-0 px-0">{children}</div>
  );
}
