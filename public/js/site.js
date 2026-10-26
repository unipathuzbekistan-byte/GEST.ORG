'use strict';
const toggle=document.querySelector('.nav-toggle'),nav=document.getElementById('nav');if(toggle&&nav)toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
for(const form of document.querySelectorAll('form[data-confirm]'))form.addEventListener('submit',event=>{if(!window.confirm(form.dataset.confirm))event.preventDefault();});
for(const button of document.querySelectorAll('button[data-submit-confirm]'))button.addEventListener('click',event=>{if(!window.confirm(button.dataset.submitConfirm))event.preventDefault();});
