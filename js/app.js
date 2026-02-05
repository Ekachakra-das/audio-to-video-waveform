// Global variables
let audioFile = null;
let wavesurfer = null;
let ffmpeg = null;

const { FFmpeg } = FFmpegWASM;
const { fetchFile, toBlobURL } = FFmpegUtil;

// Translations
const translations = {
    en: {
        loadingFfmpeg: "Loading FFmpeg core (30MB)...",
        processingVideo: "Processing video...",
        rendering: "Rendering: ",
        ffmpegError: "FFmpeg error code: ",
        fileSelected: "File selected: ",
        videoCreated: "Video created successfully!",
        downloadVideo: "Download Video",
        error: "Error: ",
        isolationWarning: "🔄 Activating isolation mode... Please reload the page (F5).",
        loadToStart: "Upload a file to start"
    },
    ru: {
        loadingFfmpeg: "Загрузка ядра FFmpeg (30MB)...",
        processingVideo: "Обработка видео...",
        rendering: "Рендеринг: ",
        ffmpegError: "Ошибка FFmpeg: ",
        fileSelected: "Файл выбран: ",
        videoCreated: "Видео успешно создано!",
        downloadVideo: "Скачать видео",
        error: "Ошибка: ",
        isolationWarning: "🔄 Активация режима изоляции... Перезагрузите страницу (F5).",
        loadToStart: "Загрузите файл для начала"
    }
};

// UI Initialization
function initApp() {
    const lang = document.documentElement.lang || 'en';
    const t = translations[lang] || translations.en;

    const fileInput = document.getElementById('fileInput');
    const dropzone = document.getElementById('dropzone');
    const generateBtn = document.getElementById('generateBtn');
    const status = document.getElementById('status');
    const playBtn = document.getElementById('playBtn');

    // Check isolation
    if (!window.crossOriginIsolated) {
        status.innerHTML = `<span style="color: #f1c40f">${t.isolationWarning}</span>`;
        console.warn("Cross-Origin Isolation is not active yet.");
    }

    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (file) handleFile(file);
        fileInput.value = '';
    };

    dropzone.ondragover = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary)';
        dropzone.style.background = 'rgba(46, 204, 113, 0.05)';
    };
    dropzone.ondragleave = () => {
        dropzone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        dropzone.style.background = 'transparent';
    };
    dropzone.ondrop = (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        dropzone.style.background = 'transparent';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('audio/')) handleFile(file);
    };

    function handleFile(file) {
        audioFile = file;
        initWaveform(file);
        document.getElementById('dropzone').style.display = 'none';
        document.getElementById('controls').style.display = 'grid';
        document.getElementById('playbackControls').style.display = 'block';
        document.getElementById('resultSection').style.display = 'none';
        generateBtn.style.display = 'block';
        status.innerText = `${t.fileSelected}${file.name}`;
    }

    function saveSettings() {
        const settings = {
            width: document.getElementById('width').value,
            height: document.getElementById('height').value,
            waveType: document.getElementById('waveType').value,
            waveColor: document.getElementById('waveColor').value,
            sensitivity: document.getElementById('sensitivity').value,
            thickness: document.getElementById('thickness').value
        };
        localStorage.setItem('waveform_settings', JSON.stringify(settings));
    }

    function loadSettings() {
        const saved = localStorage.getItem('waveform_settings');
        if (saved) {
            const settings = JSON.parse(saved);
            document.getElementById('width').value = settings.width || 1000;
            document.getElementById('height').value = settings.height || 150;
            document.getElementById('waveType').value = settings.waveType || 'bars';
            document.getElementById('waveColor').value = settings.waveColor || '#2ecc71';
            if (settings.sensitivity) document.getElementById('sensitivity').value = settings.sensitivity;
            if (settings.thickness) document.getElementById('thickness').value = settings.thickness;
        }
    }

    function updateSettings() {
        const colorInput = document.getElementById('waveColor');
        const typeInput = document.getElementById('waveType');
        const zoomInput = document.getElementById('sensitivity');
        const thicknessInput = document.getElementById('thickness');

        if (!colorInput || !typeInput || !zoomInput || !thicknessInput) return;

        const color = colorInput.value;
        const type = typeInput.value;
        const zoom = zoomInput.value;

        const colorHex = document.getElementById('colorHex');
        if (colorHex) colorHex.innerText = color.toUpperCase();

        const thicknessGroup = document.getElementById('thicknessGroup');
        if (thicknessGroup) {
            thicknessGroup.style.display = (type === 'bars') ? 'block' : 'none';
        }

        if (wavesurfer) {
            try {
                const waveformEl = document.getElementById('waveform');
                waveformEl.classList.remove('stars-active', 'bg-space', 'minimal-line', 'bg-line');
                waveformEl.style.setProperty('--glow-color', color);

                const currentWidth = document.getElementById('width').value;
                waveformEl.style.setProperty('--bg-width', `${currentWidth}px`);

                const canvas = waveformEl.querySelector('canvas');
                if (canvas) canvas.style.opacity = '1';

                let wsOptions = {
                    height: 120,
                    cursorWidth: 2,
                    cursorColor: '#ffffff',
                    normalize: true
                };

                if (type === 'bars') {
                    wsOptions.waveColor = 'transparent';
                    wsOptions.progressColor = 'transparent';
                    wsOptions.barWidth = 2;
                    wsOptions.barHeight = 120;
                    waveformEl.classList.add('bg-line');
                } else if (type === 'equalizer') {
                    wsOptions.waveColor = color;
                    wsOptions.progressColor = '#ffffff';
                    wsOptions.barWidth = 1;
                    wsOptions.barGap = 0;
                    wsOptions.barRadius = 0;
                    wsOptions.barHeight = Math.min(zoom * 0.4, 1.0);
                } else if (type === 'space') {
                    wsOptions.waveColor = 'transparent';
                    wsOptions.progressColor = 'transparent';
                    wsOptions.barWidth = 2;
                    wsOptions.barHeight = 120;
                    waveformEl.classList.add('bg-space', 'minimal-line');
                }

                wavesurfer.setOptions(wsOptions);
            } catch (e) {
                console.warn("WaveSurfer not ready for options update yet");
            }
        }
    }

    saveSettings();

    document.getElementById('waveColor').oninput = updateSettings;
    document.getElementById('sensitivity').oninput = updateSettings;
    document.getElementById('thickness').oninput = updateSettings;

    const styleButtons = document.querySelectorAll('#waveTypeContainer .toggle-btn');
    styleButtons.forEach(btn => {
        btn.onclick = () => {
            styleButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('waveType').value = btn.dataset.value;
            updateSettings();
        };
    });

    document.getElementById('width').oninput = saveSettings;
    document.getElementById('height').oninput = saveSettings;

    loadSettings();

    const currentStyle = document.getElementById('waveType').value;
    styleButtons.forEach(btn => {
        if (btn.dataset.value === currentStyle) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    updateSettings();

    function initWaveform(file) {
        if (wavesurfer) wavesurfer.destroy();

        const type = document.getElementById('waveType').value;
        const color = document.getElementById('waveColor').value;
        const zoom = document.getElementById('sensitivity').value;
        const waveformEl = document.getElementById('waveform');

        waveformEl.classList.remove('bg-space', 'minimal-line', 'bg-line');

        let wsOptions = {
            container: '#waveform',
            progressColor: '#ffffff',
            cursorColor: '#ffffff',
            cursorWidth: 2,
            height: 120,
            interactive: true,
            normalize: true
        };

        if (type === 'bars') {
            wsOptions.waveColor = 'transparent';
            wsOptions.progressColor = 'transparent';
            wsOptions.barWidth = 2;
            wsOptions.barHeight = 120;
            waveformEl.classList.add('bg-line');
        } else if (type === 'equalizer') {
            wsOptions.waveColor = color;
            wsOptions.progressColor = '#ffffff';
            wsOptions.barWidth = 1;
            wsOptions.barGap = 0;
            wsOptions.barRadius = 0;
            wsOptions.barHeight = Math.min(zoom * 0.4, 1.0);
        } else if (type === 'space') {
            wsOptions.waveColor = 'transparent';
            wsOptions.progressColor = 'transparent';
            wsOptions.barWidth = 2;
            wsOptions.barHeight = 120;
            waveformEl.classList.add('bg-space', 'minimal-line');
        }

        wavesurfer = WaveSurfer.create(wsOptions);
        wavesurfer.on('play', () => {
            document.getElementById('playIcon').innerText = '⏸';
        });
        wavesurfer.on('pause', () => {
            document.getElementById('playIcon').innerText = '▶';
        });

        const seekPoint = document.getElementById('seekPoint');
        const lineOverlay = document.getElementById('lineOverlay');

        const syncUI = (currentTime) => {
            const duration = wavesurfer.getDuration();
            if (duration > 0) {
                const percent = (currentTime / duration) * 100;
                seekPoint.style.left = `${percent}%`;
                lineOverlay.style.clipPath = `inset(0 ${100 - percent}% 0 0)`;
            }
        };

        wavesurfer.on('timeupdate', syncUI);
        wavesurfer.on('interaction', () => syncUI(wavesurfer.getCurrentTime()));

        wavesurfer.load(URL.createObjectURL(file));
        waveformEl.style.display = 'block';
    }

    playBtn.onclick = () => wavesurfer && wavesurfer.playPause();

    generateBtn.onclick = async () => {
        const progressFill = document.getElementById('progressFill');
        const progressBar = document.getElementById('progressBar');

        try {
            if (!ffmpeg) {
                status.innerText = t.loadingFfmpeg;
                ffmpeg = new FFmpeg();

                await ffmpeg.load({
                    coreURL: await toBlobURL('ffmpeg/ffmpeg-core.js', 'text/javascript'),
                    wasmURL: await toBlobURL('ffmpeg/ffmpeg-core.wasm', 'application/wasm'),
                });
            }

            status.innerText = t.processingVideo;
            progressBar.style.display = 'block';
            generateBtn.disabled = true;

            ffmpeg.on('progress', ({ progress }) => {
                progressFill.style.width = `${progress * 100}%`;
                status.innerText = `${t.rendering}${Math.round(progress * 100)}%`;
            });

            ffmpeg.on('log', ({ message }) => {
                console.log('FFmpeg Log:', message);
            });

            const inputExt = audioFile.name.substring(audioFile.name.lastIndexOf('.'));
            const inputName = 'input' + inputExt;
            await ffmpeg.writeFile(inputName, await fetchFile(audioFile));

            const w = Math.floor(document.getElementById('width').value / 2) * 2;
            const h = Math.floor(document.getElementById('height').value / 2) * 2;

            const hexColor = document.getElementById('waveColor').value;
            const color = hexColor.replace('#', '0x');
            const colorFfmpeg = hexColor.replace('#', '0x');
            const type = document.getElementById('waveType').value;
            const zoom = parseFloat(document.getElementById('sensitivity').value);
            const thickness = parseInt(document.getElementById('thickness').value);

            const volumeGain = zoom;

            const r = parseInt(hexColor.slice(1, 3), 16);
            const g = parseInt(hexColor.slice(3, 5), 16);
            const b = parseInt(hexColor.slice(5, 7), 16);

            const stereoFix = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo';

            let complexFilter = '';
            if (type === 'bars') {
                let barsFilter = `[0:a]${stereoFix},volume=${volumeGain},showwaves=s=${w}x${h}:mode=p2p:colors=${colorFfmpeg}:r=25,format=gbrp`;
                for (let i = 1; i < thickness; i++) {
                    barsFilter += `,dilation=coordinates=255`;
                }
                complexFilter = `${barsFilter},format=yuv420p[v]`;
            } else if (type === 'equalizer') {
                const halfH = Math.floor(h / 2);
                complexFilter = `[0:a]${stereoFix},volume=${volumeGain},showfreqs=s=${w}x${halfH}:mode=bar:colors=${colorFfmpeg}|${colorFfmpeg}:fscale=log:ascale=sqrt:r=25:averaging=0.9:win_size=4096[top];[top]split[t1][t2];[t2]vflip[bot];[t1][bot]vstack,format=yuv420p[v]`;
            } else if (type === 'space') {
                const lissajousZoom = Math.max(1, zoom);
                complexFilter = `[0:a]${stereoFix},volume=${volumeGain},adelay=0|10,avectorscope=s=${w}x${h}:m=lissajous:rc=${r}:gc=${g}:bc=${b}:r=25:draw=dot:zoom=${lissajousZoom},format=yuv420p[v]`;
            } else {
                complexFilter = `[0:a]${stereoFix},volume=${volumeGain},showwaves=s=${w}x${h}:mode=line:colors=${color}:r=25,format=yuv420p[v]`;
            }

            const result = await ffmpeg.exec([
                '-y',
                '-i', inputName,
                '-filter_complex', complexFilter,
                '-map', '[v]',
                '-map', '0:a',
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'ultrafast',
                '-crf', '28',
                'output.mp4'
            ]);

            if (result !== 0) throw new Error(t.ffmpegError + result);

            const data = await ffmpeg.readFile('output.mp4');
            const url = URL.createObjectURL(new Blob([data.buffer], { type: 'video/mp4' }));

            const sizeInMB = (data.length / (1024 * 1024)).toFixed(2);

            const resultSection = document.getElementById('resultSection');
            const outputVideo = document.getElementById('outputVideo');
            const downloadBtn = document.getElementById('downloadBtn');

            outputVideo.src = url;
            downloadBtn.href = url;
            downloadBtn.innerHTML = `${t.downloadVideo} (${sizeInMB} MB)`;
            downloadBtn.download = audioFile.name.split('.')[0] + '_waveform.mp4';

            resultSection.style.display = 'block';
            progressBar.style.display = 'none';
            status.innerText = t.videoCreated;
            generateBtn.disabled = false;
        } catch (err) {
            console.error(err);
            status.innerText = t.error + (err.message || err);
            generateBtn.disabled = false;
        }
    };
}

window.addEventListener('load', initApp);
