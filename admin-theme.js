const root=document.documentElement;
const button=document.getElementById('themeToggle');
const key='sitroAdminTheme';

function currentTheme(){return root.dataset.adminTheme==='light'?'light':'dark'}
function renderThemeButton(){
  if(!button)return;
  const light=currentTheme()==='light';
  button.setAttribute('aria-pressed',String(light));
  button.setAttribute('aria-label',light?'Включить тёмную тему':'Включить светлую тему');
  button.title=light?'Переключить на тёмную тему':'Переключить на светлую тему';
  button.innerHTML='<span class="theme-toggle-icon" aria-hidden="true">'+(light?'☀️':'🌙')+'</span><span class="theme-toggle-label">'+(light?'Светлая':'Тёмная')+'</span>';
}

button?.addEventListener('click',()=>{
  const next=currentTheme()==='light'?'dark':'light';
  root.dataset.adminTheme=next;
  try{localStorage.setItem(key,next)}catch{}
  renderThemeButton();
});

renderThemeButton();
