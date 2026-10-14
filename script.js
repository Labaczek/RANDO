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
$('authForm').onsubmit=async e=>{e.preventDefault();if(!db)return;const email=$('email').value.trim(),password=$('password').value;$('authSubmit').disabled=true;$('authMsg').textContent='Proszę czekać...';const {data,error}=authMode==='register'?await db.auth.signUp({email,password}):await db.auth.signInWithPassword({email,password});$('authSubmit').disabled=false;if(error){$('authMsg').textContent=error.message;return}if(authMode==='register'&&!data.session){$('authMsg').textContent='Sprawdź pocztę i potwierdź adres e-mail, a potem się zaloguj.';return}$('loginDialog').close();$('authMsg').textContent='';};
async function signed(path){if(!path)return null;const {data,error}=await db.storage.from('moments').createSignedUrl(path,120);if(error)throw error;return data.signedUrl}
function setProfileFields(p){if(!p)return;for(const k of ['name','birthdate','occupation','goal','country','region','about'])if(p[k]!=null&&$(k))$(k).value=p[k];$('interests').value=(p.interests||[]).join(', ')}
function setPrefsFields(p){if(!p)return;for(const k of ['area','filterGoal','ageMin','ageMax']){const column={filterGoal:'goal',ageMin:'age_min',ageMax:'age_max'}[k]||k;if(p[column]!=null)$(k).value=p[column]}document.querySelector(`input[name="matching"][value="${p.matching||'similar'}"]`)?.click()}
async function loadUserData(){if(!user)return;const [p,f]=await Promise.all([db.from('profiles').select('*').eq('id',user.id).maybeSingle(),db.from('preferences').select('*').eq('user_id',user.id).maybeSingle()]);if(p.error)msg(p.error.message);if(f.error)msg(f.error.message);profile=p.data;preferences=f.data;setProfileFields(profile);setPrefsFields(preferences)}
$('profileForm').onsubmit=async e=>{e.preventDefault();if(!requireAuth())return;const birth=$('birthdate').value;const age=new Date().getFullYear()-new Date(birth).getFullYear()-(new Date().toISOString().slice(5,10)<birth.slice(5)?1:0);if(age<18){$('profileMsg').textContent='RANDO jest tylko dla osób 18+.';return}const payload={id:user.id,name:$('name').value.trim(),birthdate:birth,occupation:$('occupation').value.trim(),goal:$('goal').value,country:$('country').value.trim().toUpperCase(),region:$('region').value.trim(),interests:$('interests').value.split(',').map(x=>x.trim()).filter(Boolean).slice(0,12),about:$('about').value.trim()};const {error}=await db.from('profiles').upsert(payload);$('profileMsg').textContent=error?error.message:'✓ Profil zapisany';if(!error){profile=payload;msg('Profil zapisany. Możesz opublikować swój pierwszy moment.')}};
$('settingsForm').onsubmit=async e=>{e.preventDefault();if(!requireAuth())return;const min=Number($('ageMin').value),max=Number($('ageMax').value);if(min<18||max>100||max<min){$('settingsMsg').textContent='Sprawdź przedział wieku.';return}const payload={user_id:user.id,area:$('area').value,goal:$('filterGoal').value,age_min:min,age_max:max,matching:document.querySelector('input[name="matching"]:checked').value};const {error}=await db.from('preferences').upsert(payload);$('settingsMsg').textContent=error?error.message:'✓ Filtry zapisane';if(!error)preferences=payload};

// Aparat RANDO: dwa kolejne zdjęcia, bez możliwości przesłania pliku z galerii.
let cameraStream=null, cameraStage=0, rearFrame=null, capturedMoment=null;
let activeCameraId=null, firstCameraId=null;
const camVideo=$('cameraVideo'),camCanvas=$('cameraResult'),camStatus=$('cameraStatus');
camVideo.setAttribute('playsinline','');
camVideo.muted=true;
function stopCamera(){
 if(cameraStream){cameraStream.getTracks().forEach(track=>track.stop());cameraStream=null}
 camVideo.pause();camVideo.srcObject=null;activeCameraId=null;
}
function cameraErrorMessage(error){
 switch(error?.name){
  case 'NotAllowedError':case 'PermissionDeniedError':return 'Brak zgody na aparat. Zezwól tej stronie na korzystanie z kamery w ustawieniach przeglądarki i spróbuj ponownie.';
  case 'NotFoundError':case 'DevicesNotFoundError':return 'Nie wykryto aparatu. Sprawdź, czy telefon lub komputer udostępnia kamerę tej przeglądarce.';
  case 'NotReadableError':case 'TrackStartError':return 'Aparat jest zajęty przez inną aplikację lub niedostępny. Zamknij inne aplikacje używające kamery.';
  case 'OverconstrainedError':return 'Nie znaleziono kamery o wymaganych parametrach.';
  case 'SecurityError':return 'Przeglądarka zablokowała aparat. Otwórz RANDO przez HTTPS.';
  default:return 'Nie udało się uruchomić aparatu: '+(error?.message||'nieznany błąd');
 }
}
async function availableCameras(){
 try{return (await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='videoinput')}
 catch{return []}
}
async function startFacing(facing,excludeId=null){
 stopCamera();
 const devices=await availableCameras();
 const other=excludeId?devices.find(d=>d.deviceId&&d.deviceId!==excludeId):null;
 const constraints=[];
 if(other)constraints.push({video:{deviceId:{exact:other.deviceId}},audio:false});
 constraints.push({video:{facingMode:{ideal:facing}},audio:false});
 constraints.push({video:true,audio:false});
 let error;
 for(const opts of constraints){
  try{cameraStream=await navigator.mediaDevices.getUserMedia(opts);break}
  catch(e){error=e;if(e.name==='NotAllowedError'||e.name==='PermissionDeniedError')break}
 }
 if(!cameraStream)throw error||new Error('Nie znaleziono kamery');
 activeCameraId=cameraStream.getVideoTracks()[0]?.getSettings()?.deviceId||null;
 camVideo.srcObject=cameraStream;
 camVideo.hidden=false;camCanvas.hidden=true;$('cameraPlaceholder').hidden=true;
 try{await camVideo.play()}catch(e){stopCamera();throw e}
 $('cameraCapture').disabled=false;
}
$('cameraStart').onclick=async()=>{
 if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
  camStatus.textContent='Aparat wymaga HTTPS oraz aktualnej przeglądarki z obsługą kamery.';return;
 }
 cameraStage=0;rearFrame=null;capturedMoment=null;firstCameraId=null;
 $('cameraCapture').disabled=true;$('cameraStart').disabled=true;
 camStatus.textContent='Proszę o dostęp do aparatu…';
 try{
  await startFacing('environment');firstCameraId=activeCameraId;
  camStatus.textContent='1/2 — zrób zdjęcie tylną kamerą (lub dostępną kamerą).';
  $('cameraStart').hidden=true;$('cameraRetake').hidden=false;
 }catch(e){camStatus.textContent=cameraErrorMessage(e)}
 finally{$('cameraStart').disabled=false}
};
function frameFromVideo(){
 const c=document.createElement('canvas');c.width=camVideo.videoWidth;c.height=camVideo.videoHeight;
 if(!c.width||!c.height)throw Error('Poczekaj, aż pojawi się obraz z kamery.');
 c.getContext('2d').drawImage(camVideo,0,0,c.width,c.height);return c;
}
$('cameraCapture').onclick=async()=>{
 $('cameraCapture').disabled=true;
 try{
  if(cameraStage===0){
   rearFrame=frameFromVideo();cameraStage=1;
   camStatus.textContent='Przełączanie na aparat do selfie…';
   try{
    await startFacing('user',firstCameraId);
    const cameras=await availableCameras();
    const onlyOne=cameras.length===1||Boolean(firstCameraId&&activeCameraId===firstCameraId);
    camStatus.textContent=onlyOne?'2/2 — nie wykryto drugiej kamery. Zrób selfie dostępną kamerą.':'2/2 — teraz zrób selfie przednią kamerą.';
   }catch(e){
    cameraStage=0;rearFrame=null;
    camStatus.textContent=cameraErrorMessage(e)+' Kliknij „Zrób ponownie”, aby spróbować od początku.';
   }
   return;
  }
  if(cameraStage!==1)return;
  const selfie=frameFromVideo();stopCamera();camVideo.hidden=true;
  const W=1080,H=810;camCanvas.width=W;camCanvas.height=H;const ctx=camCanvas.getContext('2d');
  function cover(source,x,y,w,h){const sw=source.width,sh=source.height,ratio=Math.max(w/sw,h/sh),cw=w/ratio,ch=h/ratio;ctx.drawImage(source,(sw-cw)/2,(sh-ch)/2,cw,ch,x,y,w,h)}
  cover(rearFrame,0,0,W,H);const sw=310,sh=310,pad=22;
  ctx.fillStyle='#fff';ctx.fillRect(W-sw-pad-5,pad-5,sw+10,sh+10);cover(selfie,W-sw-pad,pad,sw,sh);
  camCanvas.hidden=false;
  capturedMoment=await new Promise(resolve=>camCanvas.toBlob(resolve,'image/jpeg',.85));
  if(!capturedMoment)throw Error('Nie udało się przygotować zdjęcia');
  cameraStage=2;camStatus.textContent='✓ Moment gotowy. Dodaj podpis i opublikuj.';
 }catch(e){camStatus.textContent='Błąd aparatu: '+e.message}
 finally{if(cameraStream&&cameraStage<2)$('cameraCapture').disabled=false}
};
$('cameraRetake').onclick=()=>{
 stopCamera();capturedMoment=null;rearFrame=null;cameraStage=0;firstCameraId=null;
 camCanvas.hidden=true;camVideo.hidden=true;$('cameraStart').hidden=false;
 $('cameraRetake').hidden=true;$('cameraCapture').disabled=true;
 $('cameraPlaceholder').hidden=false;camStatus.textContent='Naciśnij „Uruchom aparat” ponownie.';
};
document.querySelectorAll('[data-page]').forEach(b=>b.addEventListener('click',()=>{
 if(b.dataset.page!=='moment'&&cameraStream){$('cameraRetake').click()}
}));
$('momentForm').onsubmit=async e=>{e.preventDefault();if(!requireAuth())return;if(!profile){$('momentMsg').textContent='Najpierw zapisz swój profil.';page('profile');return}const file=capturedMoment;if(!file||file.size>5*1024*1024){$('momentMsg').textContent='Najpierw wykonaj oba zdjęcia aparatem (maks. 5 MB).';return}const caption=$('caption').value.trim();if(!caption)return;const {data:existing}=await db.from('moments').select('id').eq('user_id',user.id).eq('day',new Date().toISOString().slice(0,10)).maybeSingle();if(existing){$('momentMsg').textContent='Dzisiaj już opublikowano moment.';return}const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`${user.id}/${crypto.randomUUID()}.${ext}`;$('momentMsg').textContent='Wysyłanie zdjęcia...';const upload=await db.storage.from('moments').upload(path,file,{contentType:file.type,upsert:false});if(upload.error){$('momentMsg').textContent=upload.error.message;return}const insert=await db.from('moments').insert({user_id:user.id,photo_path:path,caption});if(insert.error){await db.storage.from('moments').remove([path]);$('momentMsg').textContent=insert.error.message;return}$('momentMsg').textContent='✓ Moment opublikowany!';$('momentForm').reset();$('cameraRetake').click();loadMyMoment()};
async function loadMyMoment(){if(!user||!db){$('myMoment').hidden=true;return}const {data,error}=await db.from('moments').select('photo_path,caption,day').eq('user_id',user.id).order('day',{ascending:false}).limit(1).maybeSingle();if(error){msg(error.message);return}if(!data){$('myMoment').hidden=true;return}try{const url=await signed(data.photo_path);$('myMoment').hidden=false;$('myMoment').replaceChildren();const title=document.createElement('h3');title.textContent=`Twój moment — ${data.day}`;const img=document.createElement('img');img.src=url;img.alt='Twój opublikowany moment';const p=document.createElement('p');p.textContent=data.caption;$('myMoment').append(title,img,p)}catch(e){msg(e.message)}}
async function loadDiscovery(){const body=$('discoveryBody'),area=$('revealArea');area.replaceChildren();if(!configured){body.textContent='Aby uruchomić RANDO, skonfiguruj Supabase zgodnie z plikiem START_TUTAJ.md.';return}if(!user){body.textContent='Zaloguj się, żeby odkryć dzisiejszy moment.';return}if(!profile){body.textContent='Najpierw uzupełnij profil w zakładce Profil.';return}body.textContent='Szukamy dzisiejszego momentu...';const {data,error}=await db.rpc('discover_today');if(error){body.textContent='Nie udało się załadować momentu.';msg(error.message);return}discovery=data?.[0]||null;if(!discovery){body.textContent='Na dziś nie ma osoby spełniającej Twoje filtry. Wróć później lub zmień filtry.';$('momentStatus').textContent='BRAK';return}try{const url=await signed(discovery.photo_path);body.replaceChildren();const img=document.createElement('img');img.src=url;img.alt='Dzisiejszy moment nieznajomej osoby';img.className='real-photo';const p=document.createElement('div');p.className='moment-caption';p.textContent=discovery.caption;body.append(img,p);$('momentStatus').textContent='01 / 01';if(discovery.revealed){await reveal();return}const button=document.createElement('button');button.className='secondary';button.textContent='Odkryj profil →';button.onclick=reveal;area.append('Kim jest osoba za tym momentem?',button)}catch(e){body.textContent='Nie udało się wyświetlić zdjęcia.';msg(e.message)}}
async function reveal(){if(!discovery||!user)return;const {data,error}=await db.rpc('reveal_today');if(error){msg(error.message);return}if(data?.[0]){discovery={...discovery,...data[0],revealed:true};showRevealed()}}
function showRevealed(){const area=$('revealArea');area.replaceChildren();const p=document.createElement('div');p.className='reveal-profile';p.innerHTML=`<h3>${safe(discovery.name)}, ${safe(discovery.age)} ✨</h3><p>${safe(discovery.occupation||'')}</p><p>${safe((discovery.interests||[]).join(' · '))}</p><p>${safe(discovery.about||'')}</p><p>${discovery.goal==='dating'?'Szukam randek':discovery.goal==='friends'?'Szukam znajomych':'Szukam znajomych i randek'}</p>`;area.append(p);const button=document.createElement('button');button.className='secondary';button.textContent='❤️ Chcę poznać';button.onclick=async()=>{button.disabled=true;const {data,error}=await db.rpc('express_interest');if(error){msg(error.message);button.disabled=false;return}button.textContent=data?'💜 To MATCH!':'✓ Zaproszenie zapisane'};area.append(button)}
$('discover').onclick=()=>{if(!requireAuth())return;document.querySelector('.preview').scrollIntoView({behavior:'smooth',block:'center'});loadDiscovery()};
if(!configured)msg('RANDO czeka na konfigurację Supabase. Otwórz START_TUTAJ.md — po konfiguracji zniknie ten komunikat.');
else{db.auth.onAuthStateChange((_event,session)=>{const next=session?.user||null;if(next?.id===user?.id)return;user=next;profile=null;preferences=null;discovery=null;$('authBtn').textContent=user?'Wyloguj się':'Utwórz konto';if(user){loadUserData().then(()=>loadDiscovery());loadMyMoment()}else{loadDiscovery();$('myMoment').hidden=true}});db.auth.getSession().then(({data})=>{if(!data.session)loadDiscovery()})}
