
(function(){
  const HOST_ID = 'skywave-hr-widget';
  const host = document.getElementById(HOST_ID);
  if(!host) return;

  // ===== Config =====
  const defaultConfig = {
    title: 'Skywave Assistant',
    subtitle: 'Information about Skywave Technologies',
    endpoint: 'https://znp6js7q-8000.asse.devtunnels.ms/chat?user_id=9',
    srLang: 'en-US'
  };
  
  const CFG = {
  title: window.SkywaveConfig?.title || defaultConfig.title,
  subtitle: window.SkywaveConfig?.subtitle || defaultConfig.subtitle,
  endpoint: window.SkywaveConfig?.endpoint || defaultConfig.endpoint,
  srLang: window.SkywaveConfig?.srLang || defaultConfig.srLang
};

  // Shadow DOM
  const root = host.attachShadow({mode:'open'});

  // CSS (exactly as provided)
  const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;600;700&display=swap');
  
  *, body, input, button, textarea {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; !important;
  }
    .chat-button { position: fixed; bottom: 20px; right: 20px; width: 100px; height: 100px; background-color: transparent; border: none; cursor: pointer; z-index: 9999; transition: transform 0.2s; padding: 0; }
    .chat-button:hover { transform: scale(1.1); }
    .chat-button img { width: 100%; height: 100%; object-fit: contain; }
    .chat-button.hidden { display: none; }
    .chat-window { position: fixed; bottom: clamp(10px, 3vw, 20px); right: clamp(10px, 3vw, 20px); width: min(500px, 95vw); height: min(650px, 80vh); max-width: 100%; display: flex; flex-direction: column; background-color: #ffffff; border-radius: 16px; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12); overflow: hidden; z-index: 9999; }
    .chat-window.hidden { display: none; }
    .chat-header { padding: 16px 20px; background-color: #117ec2; color: #ffffff; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255, 255, 255, 0.1); }
    .chat-header-content { display: flex; align-items: center; gap: 12px; }
    .chat-header h1 { margin: 0; font-size: 16px; font-weight: 600; }
    .chat-header p { margin: 0; font-size: 12px; opacity: 0.9; }
    .close-btn { background: transparent; border: none; color: #ffffff; cursor: pointer; padding: 4px; border-radius: 4px; transition: background 0.2s; }
    .close-btn:hover { background-color: rgba(255, 255, 255, 0.1); }
    .messages-container { flex: 1; overflow-y: auto; padding: 15px; display: flex; flex-direction: column; gap: 12px; background-color: #F9FAFB; }
    .message { display: flex; }
    .message.user { justify-content: flex-end; }
    .message.bot { justify-content: flex-start; }
    .message-content { max-width: 75%; padding: 12px 16px; border-radius: 12px; font-size: 14px; line-height: 1.5; word-break: break-word; white-space: pre-wrap; }
    .message.user .message-content { background-color: #117ec2; color: #ffffff; }
    .message.bot .message-content { background-color: #ffffff; color: #1F2937; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); }
    .typing-indicator { display: flex; justify-content: flex-start; }
    .typing-dots { padding: 12px 16px; border-radius: 12px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1); display: flex; gap: 4px; }
    .typing-dot { width: 8px; height: 8px; border-radius: 50%; background-color: #9CA3AF; animation: typing 1.4s infinite; }
    .typing-dot:nth-child(2) { animation-delay: 0.2s; }
    .typing-dot:nth-child(3) { animation-delay: 0.4s; }
    .quick-questions { padding: 12px 16px; background-color: #F9FAFB; border-top: 1px solid #E5E7EB; display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .quick-questions.hidden { display: none; }
    .quick-question-btn { padding: 8px 12px; font-size: 12px; background-color: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px; cursor: pointer; text-align: left; transition: all 0.2s; color: #4B5563; }
    .quick-question-btn:hover { background-color: #F3F4F6; border-color: #4F46E5; }
    .input-area { padding: 12px 16px; background-color: #ffffff; border-top: 1px solid #E5E7EB; display: flex; gap: 8px; align-items: center; }
    .input-field { flex: 1; padding: 10px 12px; border: 1px solid #E5E7EB; border-radius: 8px; font-size: 14px; outline: none; transition: border-color 0.2s; }
    .input-field:focus { border-color: #117ec2; }
    .mic-btn, .send-btn { padding: 10px; border: none; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
    .mic-btn { background: #e77a24; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); color: #ffffff; }
    .mic-btn:hover { transform: scale(1.05); box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4); }
    .send-btn { background-color: #117ec2; color: #ffffff; }
    .send-btn:hover:not(:disabled) { background-color: #0d5a8f; transform: scale(1.05); }
    .send-btn:disabled { background-color: #E5E7EB; cursor: not-allowed; }
    .siri-mode { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: linear-gradient(135deg, #e77a24 0%, #117ec2 100%); z-index: 10001; display: flex; flex-direction: column; align-items: center; justify-content: center; animation: fadeIn 0.3s ease-in; }
    .siri-mode.hidden { display: none; }
    .siri-close { position: absolute; top: 30px; right: 30px; background: rgba(255, 255, 255, 0.15); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.3); color: #ffffff; cursor: pointer; padding: 12px; border-radius: 50%; width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; transition: all 0.3s; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); }
    .siri-close:hover { background: rgba(255, 255, 255, 0.25); transform: scale(1.1); }
    .siri-content { text-align: center; color: #ffffff; }
    .siri-status { font-size: clamp(28px, 5vw, 42px); font-weight: 700; margin-bottom: 16px; text-shadow: 0 2px 20px rgba(0, 0, 0, 0.3); }
    .siri-status.listening { animation: pulse 2s ease-in-out infinite; }
    .siri-subtitle { font-size: clamp(16px, 3vw, 20px); opacity: 0.9; margin-bottom: 60px; font-weight: 300; }
    .siri-orb-container { position: relative; width: 280px; height: 280px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .siri-ring { position: absolute; border-radius: 50%; border: 2px solid rgba(255, 255, 255, 0.2); }
    .siri-orb { position: relative; width: 180px; height: 180px; border-radius: 50%; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease; cursor: pointer; }
    .siri-orb.listening { background: radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0.6) 50%, rgba(255,255,255,0.2) 100%); box-shadow: 0 0 60px rgba(255, 255, 255, 0.6), inset 0 0 40px rgba(255, 255, 255, 0.3); animation: breathe 2s ease-in-out infinite; }
    .siri-orb.idle { background: radial-gradient(circle, rgba(255,255,255,0.7) 0%, rgba(255,255,255,0.4) 50%, rgba(255,255,255,0.1) 100%); box-shadow: 0 0 40px rgba(255, 255, 255, 0.4), inset 0 0 20px rgba(255, 255, 255, 0.2); }
    .audio-bars { position: absolute; bottom: -80px; display: flex; gap: 6px; align-items: flex-end; height: 60px; }
    .audio-bar { width: 4px; background: linear-gradient(to top, rgba(255,255,255,0.4), rgba(255,255,255,0.9)); border-radius: 2px; transition: height 0.1s ease; box-shadow: 0 0 10px rgba(255, 255, 255, 0.5); }
    .siri-action-btn { margin-top: 100px; padding: 16px 40px; font-size: 18px; font-weight: 600; background: rgba(255, 255, 255, 0.2); backdrop-filter: blur(10px); border: 2px solid rgba(255, 255, 255, 0.3); border-radius: 50px; color: #ffffff; cursor: pointer; transition: all 0.3s; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2); animation: fadeInUp 0.6s ease-out; }
    .siri-action-btn:hover { background: rgba(255, 255, 255, 0.3); transform: translateY(-2px); box-shadow: 0 6px 25px rgba(0, 0, 0, 0.3); }
    .icon { width: 20px; height: 24px; stroke: currentColor; stroke-width: 2; fill: none; stroke-linecap: round; stroke-linejoin: round; }
    @keyframes typing { 0%, 60%, 100% { transform: translateY(0); } 30% { transform: translateY(-10px); } }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.7; } }
    @keyframes breathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
    @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
    @keyframes expandRing { 0% { transform: scale(0.8); opacity: 0.6; } 100% { transform: scale(1.5); opacity: 0; } }
  `;

  root.innerHTML = `
    <style>${css}</style>

    <!-- Siri Voice Interface -->
    <div id="siriMode" class="siri-mode hidden" aria-hidden="true">
      <button id="siriCloseBtn" class="siri-close" aria-label="Close">
        <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
      <div class="siri-content">
        <h1 id="siriStatus" class="siri-status">✨ Ready</h1>
        <p id="siriSubtitle" class="siri-subtitle">Tap mic to start speaking</p>
        <div class="siri-orb-container">
          <div id="siriOrb" class="siri-orb idle">
            <svg class="icon" style="width:70px;height:70px;color:rgba(102,126,234,.7)" viewBox="0 0 24 24">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
              <line x1="12" y1="19" x2="12" y2="23"></line>
              <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
          </div>
          <div id="audioBars" class="audio-bars" style="display:none;"></div>
        </div>
        <div id="siriActionContainer"></div>
      </div>
    </div>

    <!-- Chat Widget Button -->
    <button id="chatButton" class="chat-button" aria-label="Open chat">
      <img src="https://raw.githubusercontent.com/rextambunx/skywave/master/Skybot-Photoroom.png" alt="Skybot"/>
    </button>

    <!-- Chat Window -->
    <div id="chatWindow" class="chat-window hidden" role="dialog" aria-modal="true" aria-label="Skywave HR Chatbot">
      <div class="chat-header">
        <div class="chat-header-content">
          <svg class="icon" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <div>
            <h1>${CFG.title}</h1>
            <p>${CFG.subtitle}</p>
          </div>
        </div>
        <button id="closeBtn" class="close-btn" aria-label="Close">
          <svg class="icon" viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div id="messagesContainer" class="messages-container"></div>
      <div id="quickQuestions" class="quick-questions hidden"></div>
      <div class="input-area">
        <input id="inputField" class="input-field" placeholder="Type a message..."/>
        <button id="micBtn" class="mic-btn" title="Voice">
          <svg class="icon" viewBox="0 0 24 24"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
        </button>
        <button id="sendBtn" class="send-btn" title="Send">
          <svg class="icon" viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
        </button>
      </div>
    </div>
  `;

  // Load marked if needed
  (function ensureMarked(){ if(window.marked) return; const s=document.createElement('script'); s.src='https://cdnjs.cloudflare.com/ajax/libs/marked/9.1.6/marked.min.js'; document.head.appendChild(s); })();

  // Helper
  const $ = (id) => root.getElementById(id);

  // State
  let messages = [];
  let isTyping = false;
  let isListening = false;
  let recognition = null;
  let audioLevel = 0;
  let audioInterval = null;

  const quickQuestions = window.SkywaveConfig?.quickQuestions || [
    { th: 'How many annual leave days does Rex have left in 2025?', en: 'Rex เหลือวันพักร้อนกี่วันในปี 2025' },
    { th: 'In 2025, which team will have the most and least leave?', en: 'ในปี 2025,ทีมไหนลาเยอะที่สุดและน้อยที่สุด' },
    { th: 'Summary remain annual leave everyone', en: 'สรุปวันหยุดประจำปีที่ยังคงเหลือทุกคน' },
    { th: 'In 2024, is there anyone who has never taken a annual leave', en: 'ปี 2025 มีใครไม่เคยลาพักร้อนบ้างคะ' }
  ];

  // DOM nodes in shadow
  const chatButton = $('chatButton');
  const chatWindow = $('chatWindow');
  const closeBtn = $('closeBtn');
  const messagesContainer = $('messagesContainer');
  const inputField = $('inputField');
  const sendBtn = $('sendBtn');
  const micBtn = $('micBtn');
  const quickQuestionsEl = $('quickQuestions');
  const siriMode = $('siriMode');
  const siriCloseBtn = $('siriCloseBtn');
  const siriStatus = $('siriStatus');
  const siriSubtitle = $('siriSubtitle');
  const siriOrb = $('siriOrb');
  const audioBars = $('audioBars');
  const siriActionContainer = $('siriActionContainer');

  // Init
  function init(){
    messages.push({ type:'bot', content: `Hi there! I'm SkyBot, your friendly HR assistant at Skywave Technologies.\nI'm here to help you with company policies, leave requests, or anything about your team.\nFeel free to ask me any questions!` });
    renderMessages();
    setupQuickQuestions();
  }

  function setupQuickQuestions(){
    quickQuestions.slice(0,4).forEach(q=>{
      const btn = document.createElement('button');
      btn.className = 'quick-question-btn';
      btn.textContent = q.th;
      btn.addEventListener('mousedown', ()=>{
        inputField.value = q.th;
        quickQuestionsEl.classList.add('hidden');
      });
      quickQuestionsEl.appendChild(btn);
    });
  }

  function renderMessages(){
    messagesContainer.innerHTML = '';
    messages.forEach(msg=>{
      const msgDiv = document.createElement('div');
      msgDiv.className = `message ${msg.type}`;
      const contentDiv = document.createElement('div');
      contentDiv.className = 'message-content';
      try{ contentDiv.innerHTML = (window.marked? window.marked.parse(msg.content): msg.content); }
      catch{ contentDiv.textContent = msg.content; }
      msgDiv.appendChild(contentDiv);
      messagesContainer.appendChild(msgDiv);
    });
    if(isTyping){
      const typingDiv = document.createElement('div'); typingDiv.className='typing-indicator';
      typingDiv.innerHTML = '<div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>';
      messagesContainer.appendChild(typingDiv);
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  async function sendMessage(text){
    const value = (text!=null? String(text): inputField.value).trim();
    if(!value) return;
    messages.push({ type:'user', content:value });
    isTyping = true; renderMessages(); inputField.value='';
    try{
      const response = await fetch(CFG.endpoint, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ message:value }) });
      if(!response.ok) throw new Error(`Server error: ${response.status}`);
      const data = await response.json();
      if(data.error){ messages.push({ type:'bot', content:`❌ ${data.error}` }); isTyping=false; renderMessages(); return; }
      if(data.action==='open_website' && data.url){
        const newTab = window.open(data.url,'_blank');
        const displayMessage = data.message || `กำลังเปิดหน้าลา...\n\n${data.url}`;
        messages.push({ type:'bot', content: displayMessage });
        if(!newTab){ messages.push({ type:'bot', content:'⚠️ Your browser is blocking new windows. Please allow pop-ups for this website.' }); }
        isTyping=false; renderMessages(); return;
      }
      let botAnswer='';
      if(data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]){
        botAnswer = data.candidates[0].content.parts[0].text;
      } else if(data.response){ botAnswer = data.response; }
      else if(data.answer){ botAnswer = data.answer; }
      else if(data.text){ botAnswer = data.text; }
      else if(data.message){ botAnswer = data.message; }
      else { botAnswer = 'Sorry, I could not process your request. Please try again.'; }
      botAnswer = String(botAnswer).replace(/<think>[\s\S]*?<\/think>/g,'').trim();
      messages.push({ type:'bot', content: botAnswer });
      if(!siriMode.classList.contains('hidden')){ speakText(botAnswer); }
    }catch(err){ messages.push({ type:'bot', content:`❌ เกิดข้อผิดพลาด: ${err.message}` }); }
    finally{ isTyping=false; renderMessages(); }
  }

  function speakText(text){
    if('speechSynthesis' in window){
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.lang = CFG.srLang; u.rate=1; u.pitch=1; u.volume=1; window.speechSynthesis.speak(u);
    }
  }

  function startSiriMode(){
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SR){ alert('เบราว์เซอร์นี้ไม่รองรับการแปลงเสียงเป็นข้อความ 😢 (ใช้ Chrome/Edge)'); return; }
    recognition = new SR(); recognition.lang = CFG.srLang; recognition.interimResults = true; recognition.continuous = false; recognition.start();
    siriMode.classList.remove('hidden'); siriMode.setAttribute('aria-hidden','false'); isListening = true; updateSiriUI(); startAudioAnimation();
    recognition.onresult = (event)=>{
      const transcript = Array.from(event.results).map(r=>r[0].transcript).join('');
      if(event.results[0].isFinal){ isListening=false; updateSiriUI(); sendMessage(transcript); }
    };
    recognition.onerror = (event)=>{ isListening=false; updateSiriUI(); if(event.error !== 'no-speech'){ stopSiriMode(); } };
    recognition.onend = ()=>{ isListening=false; updateSiriUI(); };
  }

  function stopSiriMode(){
    if(recognition) try{ recognition.stop(); }catch{}
    window.speechSynthesis && window.speechSynthesis.cancel();
    siriMode.classList.add('hidden'); siriMode.setAttribute('aria-hidden','true');
    isListening = false; stopAudioAnimation();
  }

  function updateSiriUI(){
    if(isListening){
      siriStatus.textContent = '🎤 Listening...'; siriStatus.classList.add('listening');
      siriSubtitle.textContent = 'Now speak your question'; siriOrb.classList.remove('idle'); siriOrb.classList.add('listening');
      audioBars.style.display = 'flex'; siriActionContainer.innerHTML = '';
    } else if (isTyping){
      siriStatus.textContent = '💭 Thinking...'; siriStatus.classList.remove('listening');
      siriSubtitle.textContent = 'Processing answer...'; siriOrb.classList.remove('listening'); siriOrb.classList.add('idle');
      audioBars.style.display = 'none'; siriActionContainer.innerHTML = '';
    } else {
      siriStatus.textContent = '✨ Ready'; siriStatus.classList.remove('listening');
      siriSubtitle.textContent = 'Tap mic to start speaking'; siriOrb.classList.remove('listening'); siriOrb.classList.add('idle');
      audioBars.style.display = 'none';
      siriActionContainer.innerHTML = '<button class="siri-action-btn" id="siriStartBtn">talking now.</button>';
      const btn = root.getElementById('siriStartBtn'); btn && btn.addEventListener('click', startSiriMode);
    }
  }

  function startAudioAnimation(){
    audioBars.innerHTML = '';
    for(let i=0;i<25;i++){ const bar = document.createElement('div'); bar.className='audio-bar'; audioBars.appendChild(bar); }
    audioInterval = setInterval(()=>{
      audioLevel = Math.random()*100; const bars = audioBars.children;
      for(let i=0;i<bars.length;i++){ const h = 10 + Math.sin((audioLevel + i*15)*0.05)*40; bars[i].style.height = h+'px'; }
      siriOrb.style.transform = `scale(${1 + (audioLevel/500)})`;
    }, 100);
    // rings created inside shadow root
    const container = root.querySelector('.siri-orb-container');
    for(let i=1;i<=3;i++){
      const ring = document.createElement('div'); ring.className='siri-ring';
      ring.style.width = `${180 + i*40}px`; ring.style.height = `${180 + i*40}px`;
      ring.style.animation = `expandRing ${2 + i*0.5}s ease-out infinite`;
      ring.style.animationDelay = `${i*0.3}s`;
      container && container.insertBefore(ring, siriOrb);
    }
  }

  function stopAudioAnimation(){
    if(audioInterval){ clearInterval(audioInterval); audioInterval = null; }
    audioLevel = 0;
    root.querySelectorAll('.siri-ring').forEach(r=>r.remove());
  }

  // Events
  chatButton.addEventListener('click', ()=>{ chatButton.classList.add('hidden'); chatWindow.classList.remove('hidden'); });
  closeBtn.addEventListener('click', ()=>{ chatWindow.classList.add('hidden'); chatButton.classList.remove('hidden'); });
  sendBtn.addEventListener('click', ()=> sendMessage());
  inputField.addEventListener('keydown', (e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendMessage(); }});
  inputField.addEventListener('focus', ()=>{ quickQuestionsEl.classList.remove('hidden'); });
  inputField.addEventListener('blur', ()=>{ setTimeout(()=> quickQuestionsEl.classList.add('hidden'), 150); });
  inputField.addEventListener('input', ()=>{ sendBtn.disabled = !inputField.value.trim() || isTyping; });
  micBtn.addEventListener('click', startSiriMode);
  siriCloseBtn.addEventListener('click', stopSiriMode);
  siriOrb.addEventListener('click', ()=>{ if(!isListening) startSiriMode(); });

  // Public API
  host.SkywaveWidget = {
    open(){ chatButton.classList.add('hidden'); chatWindow.classList.remove('hidden'); },
    close(){ chatWindow.classList.add('hidden'); chatButton.classList.remove('hidden'); },
    send: (t)=>sendMessage(t),
    config: CFG
  };

  // Boot
  init();
})();
