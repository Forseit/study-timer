class StudyTimer {
    constructor() {
        this.timeLeft = 25 * 60;
        this.totalTime = 25 * 60;
        this.isRunning = false;
        this.timerId = null;
        this.currentMode = 'work';
        this.endTime = null;
        
        this.initElements();
        this.initEventListeners();
        this.loadStats();
        this.loadState();
        this.updateDisplay();
        this.updateProgress();
    }
    
    initElements() {
        this.timeDisplay = document.getElementById('timeDisplay');
        this.modeLabel = document.getElementById('modeLabel');
        this.startBtn = document.getElementById('startBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.progressBar = document.getElementById('progressBar');
        this.modeButtons = document.querySelectorAll('.mode-btn');
        this.timerSound = document.getElementById('timerSound');
        this.clickSound = document.getElementById('clickSound');
        
        this.completedSessionsEl = document.getElementById('completedSessions');
        this.totalMinutesEl = document.getElementById('totalMinutes');
        this.currentStreakEl = document.getElementById('currentStreak');
    }
    
    initEventListeners() {
        this.startBtn.addEventListener('click', () => { this.playClick(); this.start(); });
        this.pauseBtn.addEventListener('click', () => { this.playClick(); this.pause(); });
        this.resetBtn.addEventListener('click', () => { this.playClick(); this.reset(); });
        
        this.modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => { this.playClick(); this.setMode(e.target); });
        });
        
        if ('Notification' in window && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }
    
    setMode(button) {
        if (this.isRunning) return;
        
        this.modeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        this.currentMode = button.dataset.mode;
        const minutes = parseInt(button.dataset.time);
        this.totalTime = minutes * 60;
        this.timeLeft = this.totalTime;
        
        const labels = {
            work: 'Время учиться!',
            short: 'Короткий перерыв',
            long: 'Длинный перерыв'
        };
        this.modeLabel.textContent = labels[this.currentMode];
        
        this.updateDisplay();
        this.updateProgress();
        this.saveState();
    }
    
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.startBtn.style.display = 'none';
        this.pauseBtn.style.display = 'inline-block';
        
        this.endTime = Date.now() + (this.timeLeft * 1000);
        this.saveState();
        
        this.timerId = setInterval(() => {
            const secondsLeft = Math.round((this.endTime - Date.now()) / 1000);
            
            if (secondsLeft < 0) {
                this.timeLeft = 0;
                this.updateDisplay();
                this.updateProgress();
                this.saveState();
                this.complete();
            } else if (this.timeLeft !== secondsLeft) {
                this.timeLeft = secondsLeft;
                this.updateDisplay();
                this.updateProgress();
                this.saveState();
            }
        }, 100);
    }
    
    pause() {
        this.isRunning = false;
        clearInterval(this.timerId);
        this.startBtn.style.display = 'inline-block';
        this.pauseBtn.style.display = 'none';
        this.saveState();
    }
    
    reset() {
        this.pause();
        this.timeLeft = this.totalTime;
        this.updateDisplay();
        this.updateProgress();
        this.saveState();
    }
    
    complete() {
        this.pause();
        this.timeLeft = this.totalTime; 
        this.updateDisplay();
        this.updateProgress();
        
        this.playSound();
        
        if (this.currentMode === 'work') {
            this.updateStats();
        }
        
        const messages = {
            work: 'Время вышло! Отличная работа! Сделай перерыв.',
            short: 'Перерыв закончился! Время учиться.',
            long: 'Длинный перерыв закончился! Готов к новым свершениям?'
        };
        
        this.sendNotification('StudyTimer', messages[this.currentMode]);
        this.saveState();
        
        setTimeout(() => {
        }, 500);
    }
    
    playSound() {
        if (!this.timerSound) return;
        
        this.timerSound.currentTime = 0;
        this.timerSound.volume = 0.5;
        const playPromise = this.timerSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(error => {
                console.log('Audio playback failed:', error);
            });
        }
    }
    
    playClick() {
        if (!this.clickSound) return;
        
        this.clickSound.currentTime = 0;
        this.clickSound.volume = 0.3;
        const playPromise = this.clickSound.play();
        
        if (playPromise !== undefined) {
            playPromise.catch(() => {});
        }
    }
    
    sendNotification(title, body) {
        if ('Notification' in window && Notification.permission === 'granted') {
            try {
                new Notification(title, {
                    body: body,
                    icon: 'https://cdn-icons-png.flaticon.com/512/3209/3209964.png'
                });
            } catch (e) {
                console.log('Notification failed', e);
            }
        }
    }
    
    updateDisplay() {
        const minutes = Math.floor(this.timeLeft / 60);
        const seconds = this.timeLeft % 60;
        this.timeDisplay.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        document.title = `${this.timeDisplay.textContent} - StudyTimer`;
    }
    
    updateProgress() {
        if (this.totalTime === 0) return;
        
        const circumference = 2 * Math.PI * 54;
        const progress = (this.totalTime - this.timeLeft) / this.totalTime;
        const offset = circumference * progress;
        this.progressBar.style.strokeDashoffset = offset;
    }
    
    loadStats() {
        const today = new Date().toDateString();
        const savedStats = localStorage.getItem('studyTimerStats');
        
        if (savedStats) {
            const stats = JSON.parse(savedStats);
            if (stats.date === today) {
                this.updateStatsDisplay(stats);
            } else {
                this.resetStats();
            }
        } else {
            this.resetStats();
        }
    }
    
    updateStats() {
        const today = new Date().toDateString();
        const savedStats = localStorage.getItem('studyTimerStats');
        
        let stats = savedStats ? JSON.parse(savedStats) : {};
        
        if (stats.date !== today) {
            stats = { date: today, sessions: 0, minutes: 0, streak: 0 };
        }
        
        stats.sessions++;
        stats.minutes += 25;
        stats.streak++;
        
        localStorage.setItem('studyTimerStats', JSON.stringify(stats));
        this.updateStatsDisplay(stats);
    }
    
    updateStatsDisplay(stats) {
        this.completedSessionsEl.textContent = stats.sessions;
        this.totalMinutesEl.textContent = stats.minutes;
        this.currentStreakEl.textContent = stats.streak;
    }
    
    resetStats() {
        const stats = { 
            date: new Date().toDateString(), 
            sessions: 0, 
            minutes: 0, 
            streak: 0 
        };
        localStorage.setItem('studyTimerStats', JSON.stringify(stats));
        this.updateStatsDisplay(stats);
    }

    saveState() {
        const state = {
            timeLeft: this.timeLeft,
            totalTime: this.totalTime,
            currentMode: this.currentMode
        };
        localStorage.setItem('studyTimerState', JSON.stringify(state));
    }

    loadState() {
        const savedState = localStorage.getItem('studyTimerState');
        if (savedState) {
            const state = JSON.parse(savedState);
            this.currentMode = state.currentMode;
            this.totalTime = state.totalTime;
            this.timeLeft = state.timeLeft;
            this.isRunning = false;
            
            this.modeButtons.forEach(btn => {
                btn.classList.remove('active');
                if (btn.dataset.mode === this.currentMode) {
                    btn.classList.add('active');
                }
            });
            
            const labels = {
                work: 'Время учиться!',
                short: 'Короткий перерыв',
                long: 'Длинный перерыв'
            };
            this.modeLabel.textContent = labels[this.currentMode];
            
            this.startBtn.style.display = 'inline-block';
            this.pauseBtn.style.display = 'none';
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StudyTimer();
});
