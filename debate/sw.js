// Notification support only: never cache account data, audio, or HTML.
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const fallback=new URL('index.html',self.registration.scope);
 let target=fallback.href;try{const candidate=new URL(event.notification.data?.url||target);if(candidate.origin===fallback.origin&&candidate.pathname.startsWith(new URL(self.registration.scope).pathname))target=candidate.href}catch{}
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async windows=>{const existing=windows.find(w=>w.url.split('#')[0]===target);if(existing)return existing.focus();return self.clients.openWindow(target)}));
});

self.addEventListener('push',event=>{
 let data={};try{data=event.data?.json()||{}}catch{}
 event.waitUntil(self.registration.showNotification('Openfloor',{body:typeof data.body==='string'?data.body.slice(0,200):'You have an Openfloor reminder.',tag:typeof data.tag==='string'?data.tag.slice(0,160):'openfloor-push',data:{url:data.url},icon:new URL('favicon.svg',self.registration.scope).href}));
});
