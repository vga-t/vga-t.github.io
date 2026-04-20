/**
 * Manages the 2D aesthetic & minimal cartoonish sky loading screen overlay.
 * JS parallel: Acts like a UI controller class that manipulates DOM elements.
 */
export class LoadingScreen {
    private overlay: HTMLElement;
    private progressBar: HTMLElement;
    private progressText: HTMLElement;
    private isHidden: boolean = false;

    constructor() {
        // JS parallel: Creating and inserting DOM elements dynamically into the body.
        this.overlay = document.createElement('div');
        this.overlay.id = 'loading-overlay';
        this.overlay.className = 'loading-overlay';

        this.overlay.innerHTML = `
            <div class="sky-clouds-container">
                <!-- Cartoon Cloud 1 -->
                <svg class="cartoon-cloud cloud-1" viewBox="0 0 200 100" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 30,65 A 25,25 0 0,1 65,45 A 35,35 0 0,1 125,40 A 25,25 0 0,1 165,60 A 20,20 0 0,1 170,75 A 15,15 0 0,1 155,90 L 35,90 A 20,20 0 0,1 30,65 Z" fill="#FFFFFF"/>
                </svg>
                <!-- Cartoon Cloud 2 -->
                <svg class="cartoon-cloud cloud-2" viewBox="0 0 240 120" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 40,75 A 30,30 0 0,1 80,50 A 40,40 0 0,1 150,45 A 30,30 0 0,1 195,70 A 25,25 0 0,1 200,90 A 20,20 0 0,1 180,105 L 45,105 A 25,25 0 0,1 40,75 Z" fill="#FFFFFF"/>
                </svg>
                <!-- Cartoon Cloud 3 -->
                <svg class="cartoon-cloud cloud-3" viewBox="0 0 180 90" xmlns="http://www.w3.org/2000/svg">
                    <path d="M 25,55 A 20,20 0 0,1 55,40 A 30,30 0 0,1 110,35 A 20,20 0 0,1 145,50 A 15,15 0 0,1 150,65 A 15,15 0 0,1 135,80 L 30,80 A 18,18 0 0,1 25,55 Z" fill="#FFFFFF"/>
                </svg>
                <!-- Cartoon Sun Accent -->
                <div class="cartoon-sun"></div>
            </div>

            <div class="loading-content">
                <h1 class="loading-title">LOADING</h1>
                <div class="progress-container">
                    <div class="progress-bar-fill" id="loading-bar"></div>
                </div>
                <div class="progress-text" id="loading-text">0%</div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        this.progressBar = this.overlay.querySelector('#loading-bar') as HTMLElement;
        this.progressText = this.overlay.querySelector('#loading-text') as HTMLElement;
    }

    /**
     * Updates loading progress (0 to 1 ratio or 0 to 100 percentage).
     * JS parallel: Clamp and set style width + text content.
     */
    public updateProgress(ratio: number): void {
        if (this.isHidden) return;
        const clampedRatio = Math.min(Math.max(ratio, 0), 1);
        const percentage = Math.round(clampedRatio * 100);

        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
        }
        if (this.progressText) {
            this.progressText.textContent = `${percentage}%`;
        }
    }

    /**
     * Smoothly fades out the loading screen and removes it from view.
     * JS parallel: Promise wrapper around CSS transition end.
     */
    public hide(): Promise<void> {
        if (this.isHidden) return Promise.resolve();
        this.isHidden = true;

        // Ensure 100% is displayed briefly before fading out
        this.updateProgress(1);

        return new Promise((resolve) => {
            // Small delay so user sees 100% finish
            setTimeout(() => {
                this.overlay.classList.add('fade-out');

                const onTransitionEnd = () => {
                    this.overlay.removeEventListener('transitionend', onTransitionEnd);
                    if (this.overlay.parentNode) {
                        this.overlay.parentNode.removeChild(this.overlay);
                    }
                    resolve();
                };

                this.overlay.addEventListener('transitionend', onTransitionEnd);

                // Safety fallback if transition event doesn't fire
                setTimeout(() => {
                    if (this.overlay.parentNode) {
                        this.overlay.parentNode.removeChild(this.overlay);
                    }
                    resolve();
                }, 900);
            }, 300);
        });
    }
}
