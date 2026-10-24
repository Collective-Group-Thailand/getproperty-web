/** The opening of a plain public page: eyebrow, the one heading, the lead paragraph. */
export function PageIntro({ eyebrow, title, lead }: { eyebrow: string; title: string; lead: string }) {
  return (
    <header className="mx-auto flex max-w-7xl flex-col gap-5 px-4 pt-14 pb-12 md:pt-20">
      <p className="text-primary text-sm font-semibold">{eyebrow}</p>
      <h1 className="max-w-4xl text-5xl leading-tight">{title}</h1>
      <p className="text-muted max-w-2xl text-xl leading-relaxed">{lead}</p>
    </header>
  );
}
