type NavbarProps = {
    onGetStarted: () => void;
};

export default function Navbar({ onGetStarted }: NavbarProps) {
    return (
        <header className="ca-nav">
            <div className="ca-brand">
                <span className="ca-brand-mark">✦</span>
                <span className="ca-brand-word">CODE ATLAS</span>
                <nav className="ca-nav-links">
                    <a href="#" className="active">Explorer</a>
                    <a href="#">Architecture</a>
                    <a href="#">Flows</a>
                </nav>
            </div>
            <div className="ca-nav-right">
                <button className="ca-btn-ghost">AI Assistant</button>
                <button className="ca-btn-primary" onClick={onGetStarted}>Upload</button>
                <button className="ca-icon-btn" aria-label="Settings">⚙</button>
            </div>
        </header>
    );
}
