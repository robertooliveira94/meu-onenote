import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <div className="max-w-sm text-center">
        <h1 className="text-[21px] font-bold tracking-[-0.02em]">Esta página não existe mais</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-tinta-2">
          O arquivo pode ter sido renomeado, movido ou excluído por fora do aplicativo.
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-[13px] underline underline-offset-2"
          style={{ color: "var(--realce)" }}
        >
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
