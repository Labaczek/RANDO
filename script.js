import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const $=id=>document.getElementById(id);
const config=window.RANDO_CONFIG||{};
const configured=/^https:\/\/.+\.supabase\.co$/.test(config.url||'')&&config.publishableKey&&!config.publishableKey.startsWith('WPISZ_');
const db=configured?createClient(config.url,config.publishableKey):null;
let user=null,profile=null,preferences=null,discovery=null,authMode='register';
const msg=(text)=>{$('globalMsg').textContent=text;$('globalMsg').hidden=!text};
const safe=(s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function page(id){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('active',x.id===id));document.querySelectorAll('[data-page]').forEach(x=>x.classList.toggle('active',x.dataset.page===id));window.scrollTo({top:0,behavior:'smooth'});if(id==='home')loadDiscovery();if(id==='moment')loadMyMoment()}
document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>page(b.dataset.page));
function requireAuth(){if(!configured){msg('Najpierw uzupełnij plik config.js i uruchom SQL w Supabase. Instrukcja: START_TUTAJ.md');return false}if(!user){$('loginDialog').showModal();return false}return true}
$('authBtn').onclick=async()=>{if(user){await db.auth.signOut();return}if(!configured){requireAuth();return}$('loginDialog').showModal()};
$('authClose').onclick=()=>$('loginDialog').close();
$('authSwitch').onclick=()=>{authMode=authMode==='login'?'register':'login';$('authTitle').textContent=authMode==='login'?'Zaloguj się':'Utwórz konto';$('authSubmit').textContent=authMode==='login'?'Zaloguj się':'Zarejestruj się';$('authSwitch').textContent=authMode==='login'?'Utwórz konto':'Mam już konto';$('authMsg').textContent=''};
// RANDO: odzyskiwanie hasła — link dodawany do istniejącego okna logowania.
const forgotLink=document.createElement('button');
forgotLink.type='button';
forgotLink.textContent='Nie pamiętasz hasła?';
forgotLink.style.cssText='display:block;margin:12px auto 0;background:none;border:0;color:#c4a8ff;cursor:pointer;text-decoration:underline;font:inherit';
$('authForm').append(forgotLink);
forgotLink.onclick=async()=>{
  if(!db){$('authMsg').textContent='Brak połączenia z Supabase.';return}
  const email=$('email').value.trim();
  if(!email){$('authMsg').textContent='Wpisz najpierw swój adres e-mail.';return}
  forgotLink.disabled=true;
  $('authMsg').textContent='Wysyłanie wiadomości...';
  const redirectTo=new URL('reset-password.html',window.location.href).href;
  const {error}=await db.auth.resetPasswordForEmail(email,{redirectTo});
  forgotLink.disabled=false;
  $('authMsg').textContent=error?`Nie udało się wysłać wiadomości: ${error.message}`:'Jeśli konto istnieje, sprawdź pocztę i otwórz link do zmiany hasła.';
};
$('authForm').onsubmit=async e=>{e.preventDefault();if(!db)return;const email=$('email').value.trim(),password=$('password').value;$('authSubmit').disabled=true;$('authMsg').textContent='Proszę czekać...';const {data,error}=authMode==='register'?await db.auth.signUp({email,password,options:{emailRedirectTo:new URL('./',window.location.href).href}}):await db.auth.signInWithPassword({email,password});$('authSubmit').disabled=false;if(error){$('authMsg').textContent=error.message;return}if(authMode==='register'&&!data.session){$('authMsg').textContent='Sprawdź pocztę i potwierdź adres e-mail, a potem się zaloguj.';return}$('loginDialog').close();$('authMsg').textContent='';};
async function signed(path){if(!path)return null;const {data,error}=await db.storage.from('moments').createSignedUrl(path,120);if(error)throw error;return data.signedUrl}
function setProfileFields(p){if(!p)return;for(const k of ['name','birthdate','occupation','goal','country','region','about'])if(p[k]!=null&&$(k))$(k).value=p[k];$('interests').value=(p.interests||[]).join(', ')}
function setPrefsFields(p){if(!p)return;for(const k of ['area','filterGoal','ageMin','ageMax']){const column={filterGoal:'goal',ageMin:'age_min',ageMax:'age_max'}[k]||k;if(p[column]!=null)$(k).value=p[column]}document.querySelector(`input[name="matching"][value="${p.matching||'similar'}"]`)?.click()}
async function loadUserData(){if(!user)return;const [p,f]=await Promise.all([db.from('profiles').select('*').eq('id',user.id).maybeSingle(),db.from('preferences').select('*').eq('user_id',user.id).maybeSingle()]);if(p.error)msg(p.error.message);if(f.error)msg(f.error.message);profile=p.data;preferences=f.data;setProfileFields(profile);setPrefsFields(preferences)}
$('profileForm').onsubmit=async e=>{e.preventDefault();if(!requireAuth())return;const birth=$('birthdate').value;const age=new Date().getFullYear()-new Date(birth).getFullYear()-(new Date().toISOString().slice(5,10)<birth.slice(5)?1:0);if(age<18){$('profileMsg').textContent='RANDO jest tylko dla osób 18+.';return}const payload={id:user.id,name:$('name').value.trim(),birthdate:birth,occupation:$('occupation').value.trim(),goal:$('goal').value,country:$('country').value.trim().toUpperCase(),region:$('region').value.trim(),interests:$('interests').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12),about:$('about').value.trim()};const {error}=await db.from('profiles').upsert(payload);$('profileMsg').textContent=error?error.message:'✓ Profil zapisany';if(!error){profile=payload;msg('Profil zapisany. Możesz opublikować swój pierwszy moment.')}};
$('settingsForm').onsubmit=async e=>{e.preventDefault();if(!requireAuth())return;const min=Number($('ageMin').value),max=Number($('ageMax').value);if(min<18||max>100||max<min){$('settingsMsg').textContent='Sprawdź przedział wieku.';return}const payload={user_id:user.id,area:$('area').value,goal:$('filterGoal').value,age_min:min,age_max:max,matching:document.querySelector('input[name="matching"]:checked').value};const {error}=await db.from('preferences').upsert(payload);$('settingsMsg').textContent=error?error.message:'✓ Filtry zapisane';if(!error)preferences=payload};

// RANDO: podgląd dwóch kamer i fioletowe selfie. Bez galerii.
let cameraStream=null, selfieStream=null, capturedMoment=null, rearFrame=null, selfieFrame=null;
let cameraStage=0, swapped=false, dualMode=false, cameraBusy=false;
let shotDeadline=0, shotTimerInterval=null, shotAttempt=0;
const timerBox=$('shotTimer'), timerDisplay=$('shotCountdown');
function stopShotTimer(){
  if(shotTimerInterval!==null)clearInterval(shotTimerInterval);
  shotTimerInterval=null;shotDeadline=0;timerBox.hidden=true;
}
function shotExpired(attempt){
  return attempt!==shotAttempt || (shotDeadline>0 && Date.now()>=shotDeadline);
}
function expireShot(attempt){
  if(attempt!==shotAttempt || cameraStage===2)return;
  resetCamera();
  camStatus.textContent='⏰ RandoShot Time is over! Masz 2 minuty na wykonanie obu zdjęć. Spróbuj ponownie.';
}
function startShotTimer(){
  stopShotTimer();
  shotDeadline=Date.now()+120000;
  timerBox.hidden=false;
  const attempt=shotAttempt;
  function tick(){
    if(attempt!==shotAttempt)return;
    const remaining=Math.max(0,Math.ceil((shotDeadline-Date.now())/1000));
    timerDisplay.textContent=`${String(Math.floor(remaining/60)).padStart(2,'0')}:${String(remaining%60).padStart(2,'0')}`;
    timerBox.classList.toggle('urgent',remaining<=20);
    if(remaining===0)expireShot(attempt);
  }
  tick();shotTimerInterval=setInterval(tick,200);
}
const camVideo=$('cameraVideo'), selfieVideo=$('selfieVideo'), camCanvas=$('cameraResult');
const camStatus=$('cameraStatus'), camPreview=$('cameraPreview'), swapButton=$('cameraSwap');
function stopCamera(){
  for(const stream of [cameraStream,selfieStream]) stream?.getTracks().forEach(t=>t.stop());
  cameraStream=null;selfieStream=null;
  for(const video of [camVideo,selfieVideo]){video.pause();video.srcObject=null;video.hidden=true;}
}
function cameraErrorMessage(error){
  switch(error?.name){
    case 'NotAllowedError': return 'Zezwól na dostęp do aparatu w przeglądarce.';
    case 'NotFoundError': return 'Nie znaleziono aparatu na tym urządzeniu.';
    case 'NotReadableError': return 'Aparat jest zajęty przez inną aplikację.';
    default: return 'Nie udało się uruchomić aparatu: '+(error?.message||'nieznany błąd');
  }
}
async function openCamera(facing,excludeId=null){
  const options=[{video:{facingMode:{ideal:facing}},audio:false}];
  if(excludeId){
    const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput');
    const alternative=devices.find(d=>d.deviceId && d.deviceId!==excludeId);
    if(alternative) options.unshift({video:{deviceId:{exact:alternative.deviceId}},audio:false});
  }
  options.push({video:true,audio:false});
  let lastError;
  for(const option of options){
    try{return await navigator.mediaDevices.getUserMedia(option)}
    catch(e){lastError=e;if(e.name==='NotAllowedError')break;}
  }
  throw lastError;
}
async function attachVideo(video,stream){
  video.srcObject=stream;video.hidden=false;
  await video.play();
}
function showCameraLayout(){
  camPreview.classList.toggle('camera-swapped',swapped);
  camPreview.classList.toggle('camera-dual',dualMode);
}
function captureFrame(video){
  if(!video.videoWidth || !video.videoHeight) throw Error('Poczekaj na obraz z kamery.');
  const c=document.createElement('canvas');c.width=video.videoWidth;c.height=video.videoHeight;
  c.getContext('2d').drawImage(video,0,0,c.width,c.height);return c;
}
function drawCover(ctx,source,x,y,w,h){
  const sw=source.width,sh=source.height,scale=Math.max(w/sw,h/sh),cw=w/scale,ch=h/scale;
  ctx.drawImage(source,(sw-cw)/2,(sh-ch)/2,cw,ch,x,y,w,h);
}
function drawRandoShot(){
  if(!rearFrame||!selfieFrame)return;
  const W=1080,H=810;camCanvas.width=W;camCanvas.height=H;
  const ctx=camCanvas.getContext('2d');
  drawCover(ctx,swapped?selfieFrame:rearFrame,0,0,W,H);
  const x=W-342,y=25,s=310,r=27;
  ctx.save();ctx.shadowColor='#9c62ff';ctx.shadowBlur=25;ctx.fillStyle='#9d65ff';
  ctx.beginPath();ctx.roundRect(x-8,y-8,s+16,s+16,r+7);ctx.fill();ctx.restore();
  ctx.save();ctx.beginPath();ctx.roundRect(x,y,s,s,r);ctx.clip();
  drawCover(ctx,swapped?rearFrame:selfieFrame,x,y,s,s);ctx.restore();
}
async function saveRandoShot(){
  drawRandoShot();
  capturedMoment=await new Promise(resolve=>camCanvas.toBlob(resolve,'image/jpeg',.85));
  if(!capturedMoment)throw Error('Nie udało się przygotować zdjęcia.');
}
function showResult(){
  stopShotTimer();stopCamera();camCanvas.hidden=false;camPreview.classList.add('camera-finished');
  swapButton.hidden=false;cameraStage=2;$('cameraCapture').disabled=true;
  camStatus.textContent='✓ RandoShot gotowy.';
}
async function resetCamera(){
  shotAttempt++;stopShotTimer();stopCamera();capturedMoment=null;rearFrame=null;selfieFrame=null;
  cameraStage=0;swapped=false;dualMode=false;
  camCanvas.hidden=true;camPreview.classList.remove('camera-finished','camera-dual','camera-swapped');
  $('cameraPlaceholder').hidden=false;swapButton.hidden=true;
  $('cameraStart').hidden=false;$('cameraRetake').hidden=true;$('cameraCapture').disabled=true;
  $('cameraCapture').textContent='Zrób zdjęcie';camStatus.textContent='Aparat nieaktywny';
}
$('cameraStart').onclick=async()=>{
  if(cameraBusy)return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
    camStatus.textContent='Aparat wymaga HTTPS i obsługiwanej przeglądarki.';return;
  }
  cameraBusy=true;$('cameraStart').disabled=true;
  try{
    await resetCamera();startShotTimer();const attempt=shotAttempt;camStatus.textContent='Uruchamianie aparatu…';
    cameraStream=await openCamera('environment');
    await attachVideo(camVideo,cameraStream);
    if(shotExpired(attempt))return;
    const firstId=cameraStream.getVideoTracks()[0]?.getSettings()?.deviceId;
    try{
      // iOS Safari potrafi zwrócić dwa strumienie, ale pierwszy obraz jest czarny.
      // Na iPhone/iPad wykonujemy oba zdjęcia kolejno.
      if(/iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform==='MacIntel' && navigator.maxTouchPoints>1))throw Error('iOS: sekwencyjny aparat');
      selfieStream=await openCamera('user',firstId);
      const secondId=selfieStream.getVideoTracks()[0]?.getSettings()?.deviceId;
      if(firstId&&secondId&&firstId===secondId)throw Error('Ta sama kamera');
      await attachVideo(selfieVideo,selfieStream);
      if(shotExpired(attempt))return;
      dualMode=true;
      camStatus.textContent='';cameraStage=0;swapButton.hidden=true;
    }catch(e){
      selfieStream?.getTracks().forEach(t=>t.stop());selfieStream=null;
      selfieVideo.hidden=true;dualMode=false;cameraStage=0;
      camStatus.textContent='Najpierw zrób zdjęcie tylną kamerą, a następnie selfie.';
    }
    if(shotExpired(attempt))return;
    $('cameraPlaceholder').hidden=true;$('cameraStart').hidden=true;$('cameraRetake').hidden=false;
    $('cameraCapture').disabled=false;showCameraLayout();
  }catch(e){const errorMessage=cameraErrorMessage(e);if(shotDeadline){await resetCamera();camStatus.textContent=errorMessage}}
  finally{if(!shotDeadline&&cameraStage!==2)stopCamera();cameraBusy=false;$('cameraStart').disabled=false;}
};
$('cameraCapture').onclick=async()=>{
  if(cameraBusy||!shotDeadline||Date.now()>=shotDeadline){if(shotDeadline)expireShot(shotAttempt);return;}
  cameraBusy=true;const attempt=shotAttempt;$('cameraCapture').disabled=true;
  try{
    if(dualMode){
      rearFrame=captureFrame(camVideo);selfieFrame=captureFrame(selfieVideo);
      await saveRandoShot();if(!shotExpired(attempt))showResult();
    }else if(cameraStage===0){
      rearFrame=captureFrame(camVideo);
      const firstId=cameraStream?.getVideoTracks()[0]?.getSettings()?.deviceId;
      stopCamera();
      cameraStream=await openCamera('user',firstId);
      await attachVideo(camVideo,cameraStream);
      if(shotExpired(attempt))return;
      cameraStage=1;$('cameraCapture').textContent='Zrób selfie';
      camStatus.textContent='';$('cameraCapture').disabled=false;
    }else if(cameraStage===1){
      selfieFrame=captureFrame(camVideo);
      await saveRandoShot();if(!shotExpired(attempt))showResult();
    }
  }catch(e){camStatus.textContent=cameraErrorMessage(e);if(cameraStage<2)$('cameraCapture').disabled=false;}
  finally{cameraBusy=false;}
};
async function swapImages(){
  if(cameraStage!==2||!rearFrame||!selfieFrame)return;
  swapped=!swapped;
  showCameraLayout();
  await saveRandoShot();
  camCanvas.hidden=false;
}
swapButton.onclick=swapImages;
camPreview.onclick=e=>{if(e.target===swapButton)return;if(cameraStage===2)swapImages();};
$('cameraRetake').onclick=resetCamera;
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{
  if(b.dataset.page!=='moment'&&(cameraStream||selfieStream||shotDeadline))resetCamera();
}));
$('momentForm').onsubmit=async e=>{e.preventDefault();if(!requireAuth())return;if(!profile){$('momentMsg').textContent='Najpierw zapisz swój profil.';page('profile');return}const file=capturedMoment;if(!file||file.size>5*1024*1024){$('momentMsg').textContent='Najpierw wykonaj oba zdjęcia aparatem (maks. 5 MB).';return}const caption=$('caption').value.trim();if(!caption)return;const {data:existing}=await db.from('moments').select('id').eq('user_id',user.id).eq('day',new Date().toISOString().slice(0,10)).maybeSingle();if(existing){$('momentMsg').textContent='Dzisiaj już opublikowano RandoShot.';return}const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`${user.id}/${crypto.randomUUID()}.${ext}`;$('momentMsg').textContent='Wysyłanie zdjęcia...';const upload=await db.storage.from('moments').upload(path,file,{contentType:file.type,upsert:false});if(upload.error){$('momentMsg').textContent=upload.error.message;return}const insert=await db.from('moments').insert({user_id:user.id,photo_path:path,caption});if(insert.error){await db.storage.from('moments').remove([path]);$('momentMsg').textContent=insert.error.message;return}$('momentMsg').textContent='✓ RandoShot opublikowany!';$('momentForm').reset();$('cameraRetake').click();loadMyMoment()};
async function loadMyMoment(){
 const panel=$('myMoment');
 if(!user||!db){panel.hidden=true;return}
 const [{data,error},{data:quota,error:quotaError}]=await Promise.all([
  db.from('moments').select('id,photo_path,caption,day').eq('user_id',user.id).order('day',{ascending:false}).limit(1).maybeSingle(),
  db.rpc('rando_delete_quota')
 ]);
 if(error||quotaError){msg((error||quotaError).message);return}
 const remaining=quota?.[0]?.remaining ?? 0;
 panel.hidden=false;panel.replaceChildren();
 const count=document.createElement('p');count.textContent=`Pozostałe usunięcia RandoShot: ${remaining}/5`;
 panel.append(count);
 if(!data){const empty=document.createElement('p');empty.textContent='Nie masz jeszcze opublikowanego RandoShotu.';panel.append(empty);return}
 const title=document.createElement('h3');title.textContent=`Twój RandoShot — ${data.day}`;
 panel.append(title);
 try{const url=await signed(data.photo_path);const img=document.createElement('img');img.src=url;img.alt='Twój opublikowany RandoShot';panel.append(img)}catch(e){const warning=document.createElement('p');warning.textContent='Nie można wyświetlić zdjęcia: '+e.message;panel.append(warning)}
 const caption=document.createElement('p');caption.textContent=data.caption;panel.append(caption);
 const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent=remaining>0?'Usuń RandoShot':'Limit 5 usunięć wyczerpany';button.disabled=remaining<=0;
 button.onclick=async()=>{
  if(!confirm(`Usunąć ten RandoShot? Zostanie zużyte jedno z ${remaining} pozostałych usunięć. Tej operacji nie można cofnąć.`))return;
  button.disabled=true;button.textContent='Usuwanie...';
  const {data:deleted,error:deleteError}=await db.rpc('rando_delete_shot',{p_moment_id:data.id});
  if(deleteError){msg(deleteError.message);button.disabled=false;button.textContent='Usuń RandoShot';return}
  const storageResult=await db.storage.from('moments').remove([deleted.photo_path]);
  if(storageResult.error)msg('RandoShot usunięty, ale zdjęcie nie zostało usunięte ze Storage. Skontaktuj się z administratorem.');
  else msg('RandoShot został usunięty.');
  await loadMyMoment();await loadDiscovery();
 };
 panel.append(button);
}
async function loadDiscovery(){const body=$('discoveryBody'),area=$('revealArea');area.replaceChildren();if(!configured){body.textContent='Aby uruchomić RANDO, skonfiguruj Supabase zgodnie z plikiem START_TUTAJ.md.';return}if(!user){body.textContent='Zaloguj się, żeby odkryć RandoShot dnia.';return}if(!profile){body.textContent='Najpierw uzupełnij profil w zakładce Profil.';return}body.textContent='Szukamy RandoShotu dnia...';const {data,error}=await db.rpc('discover_today');if(error){body.textContent='Nie udało się załadować RandoShotu.';msg(error.message);return}discovery=data?.[0]||null;if(!discovery){body.textContent='Na dziś nie ma osoby spełniającej Twoje filtry. Wróć później lub zmień filtry.';$('momentStatus').textContent='BRAK';return}try{const url=await signed(discovery.photo_path);body.replaceChildren();const img=document.createElement('img');img.src=url;img.alt='RandoShot nieznajomej osoby';img.className='real-photo';const p=document.createElement('div');p.className='moment-caption';p.textContent=discovery.caption;body.append(img,p);$('momentStatus').textContent='01 / 01';if(discovery.revealed){await reveal();return}const button=document.createElement('button');button.className='secondary';button.textContent='Odkryj profil →';button.onclick=reveal;area.append('Kim jest osoba za tym RandoShotem?',button)}catch(e){body.textContent='Nie udało się wyświetlić zdjęcia.';msg(e.message)}}
async function reveal(){if(!discovery||!user)return;const {data,error}=await db.rpc('reveal_today');if(error){msg(error.message);return}if(data?.[0]){discovery={...discovery,...data[0],revealed:true};showRevealed()}}
function showRevealed(){const area=$('revealArea');area.replaceChildren();const p=document.createElement('div');p.className='reveal-profile';p.innerHTML=`<h3>${safe(discovery.name)}, ${safe(discovery.age)} ✨</h3><p>${safe(discovery.occupation||'')}</p><p>${safe((discovery.interests||[]).join(' · '))}</p><p>${safe(discovery.about||'')}</p><p>${discovery.goal==='dating'?'Szukam randek':discovery.goal==='friends'?'Szukam znajomych':'Szukam znajomych i randek'}</p>`;area.append(p);const button=document.createElement('button');button.className='secondary';button.textContent='❤️ Chcę poznać';button.onclick=async()=>{button.disabled=true;const {data,error}=await db.rpc('express_interest');if(error){msg(error.message);button.disabled=false;return}button.textContent=data?'💜 To MATCH!':'✓ Zaproszenie zapisane'};area.append(button)}
$('discover').onclick=()=>{if(!requireAuth())return;document.querySelector('.preview').scrollIntoView({behavior:'smooth',block:'center'});loadDiscovery()};
if(!configured)msg('RANDO czeka na konfigurację Supabase. Otwórz START_TUTAJ.md — po konfiguracji zniknie ten komunikat.');
else{db.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if(next?.id===user?.id)return;user=next;profile=null;preferences=null;discovery=null;$('authBtn').textContent=user?'Wyloguj się':'Utwórz konto';if(user){loadUserData().then(()=>loadDiscovery());loadMyMoment()}else{loadDiscovery();$('myMoment').hidden=true}});db.auth.getSession().then(({data})=>{if(!data.session)loadDiscovery()})}
