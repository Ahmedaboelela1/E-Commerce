import Image from 'next/image';

type SkillverseBrandProps = {
    inverse?: boolean;
    compact?: boolean;
};

/**
 * Uses the exact official Skillverse Global SVG mark from our corporate site.
 * The wordmark follows the company's navy and blue brand palette.
 */
export function SkillverseBrand({inverse = false, compact = false}: SkillverseBrandProps) {
    return (
        <span className="inline-flex shrink-0 items-center gap-2.5">
            <span className={inverse ? 'inline-flex items-center rounded-md bg-white p-1' : 'inline-flex items-center'}>
                <Image
                    src="/skillverse-brand.svg"
                    alt=""
                    width={36}
                    height={42}
                    priority={!inverse}
                    className={compact ? 'h-8 w-auto' : 'h-10 w-auto'}
                />
            </span>
            <span className={compact ? "hidden flex-col leading-none sm:inline-flex" : "inline-flex flex-col leading-none"} aria-hidden="true">
                <span className="whitespace-nowrap text-[18px] font-extrabold tracking-[-0.045em] sm:text-[20px]">
                    <span className={inverse ? 'text-white' : 'text-[#102140] dark:text-white'}>Skill</span>
                    <span className={inverse ? 'text-[#91b8fa]' : 'text-[#2e5eab] dark:text-[#91b8fa]'}>Verse</span>
                </span>
                <span className={`mt-1.5 pl-0.5 text-[9px] font-bold uppercase tracking-[0.35em] ${inverse ? 'text-[#a9c6f7]' : 'text-[#2e5eab] dark:text-[#91b8fa]'}`}>
                    GLOBAL
                </span>
            </span>
        </span>
    );
}
