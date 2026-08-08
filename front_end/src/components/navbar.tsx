type NavbarProps = {
    onGetStarted: () => void;
};

export default function Navbar({ onGetStarted }: NavbarProps) {
    return (
        <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-[rgba(8,10,13,.92)] backdrop-blur-[10px] border-b border-[#30363d] flex items-center justify-between px-4">
            <div className="flex items-center gap-[10px]">
                <span className="w-7 h-7 bg-[#007aff] text-white grid place-items-center text-[15px]">✦</span>
                <span className="font-space font-bold tracking-[-.04em] text-[#007aff] text-lg">CODE ATLAS</span>
                <nav className="hidden max-[900px]:hidden gap-6 ml-8">
                    <a href="#" className="active font-jet text-[10px] tracking-[.05em] uppercase text-[#007aff] no-underline pb-1 border-b-2 border-[#007aff]">Explorer</a>
                    <a href="#" className="font-jet text-[10px] tracking-[.05em] uppercase text-[#c1c6d7] no-underline pb-1 border-b-2 border-transparent transition-colors duration-150 hover:text-[#dfe2eb]">Architecture</a>
                    <a href="#" className="font-jet text-[10px] tracking-[.05em] uppercase text-[#c1c6d7] no-underline pb-1 border-b-2 border-transparent transition-colors duration-150 hover:text-[#dfe2eb]">Flows</a>
                </nav>
            </div>
            <div className="flex items-center gap-[14px]">
                <button className="bg-transparent border border-[#30363d] text-[#dfe2eb] px-[14px] py-[9px] font-jet text-[10px] tracking-[.05em] uppercase cursor-pointer transition-colors duration-150 hover:bg-[#262a31] hover:border-[#007aff] hover:text-[#007aff]">AI Assistant</button>
                <button className="bg-[#007aff] text-[#00285c] border border-[#007aff] px-4 py-[10px] font-jet text-[10px] font-bold tracking-[.05em] uppercase cursor-pointer transition-[filter,transform] duration-150 hover:brightness-110 active:scale-[.98]" onClick={onGetStarted}>Upload</button>
                <button className="bg-transparent border-0 text-[#c1c6d7] text-lg leading-none cursor-pointer p-1 transition-colors duration-150 hover:text-[#007aff]" aria-label="Settings">⚙</button>
            </div>
        </header>
    );
}
