const year=document.querySelector('[data-year]');
if(year) year.textContent=new Date().getFullYear();

function showLicenseStatus(message, license){
  const box=document.querySelector('[data-license-result]');
  if(!box) return;
  box.hidden=false;
  box.innerHTML='';
  const text=document.createElement('p');
  text.className='small';
  text.textContent=message;
  box.appendChild(text);
  if(license){
    const code=document.createElement('code');
    code.style.display='block';
    code.style.wordBreak='break-all';
    code.style.padding='12px';
    code.style.margin='10px 0';
    code.style.border='1px solid #31577e';
    code.style.borderRadius='10px';
    code.textContent=license;
    box.appendChild(code);
    const copy=document.createElement('button');
    copy.className='btn';
    copy.textContent='Copy license';
    copy.addEventListener('click',async()=>{
      await navigator.clipboard.writeText(license);
      copy.textContent='Copied';
    });
    box.appendChild(copy);
  }
}

async function requestLicense(transactionId,email){
  showLicenseStatus('Payment completed. Generating your List2Sheet license…');
  try{
    const response=await fetch('/api/license-issue/',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({transactionId,email})
    });
    const data=await response.json();
    if(!response.ok) throw new Error(data.error||'License generation failed');
    showLicenseStatus('Payment verified. Save this license together with your purchase email.',data.license);
  }catch(error){
    showLicenseStatus('Payment succeeded, but automatic license delivery is not ready: '+error.message);
  }
}

(function setupPaddle(){
  const buttons=document.querySelectorAll('[data-paddle-checkout]');
  if(!buttons.length) return;

  const config=window.RAINNIGHT_PADDLE||{};
  if(!window.Paddle){
    buttons.forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();
      alert('Paddle.js did not load. Please refresh and try again.');
    }));
    return;
  }

  if(!config.clientToken){
    buttons.forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();
      alert('Paddle Sandbox client-side token is not connected yet.');
    }));
    return;
  }

  Paddle.Environment.set(config.environment||'sandbox');
  Paddle.Initialize({
    token:config.clientToken,
    eventCallback:function(event){
      if(event?.name==='checkout.completed'){
        const transactionId=event.data?.transaction_id;
        const email=event.data?.customer?.email;
        if(transactionId&&email) requestLicense(transactionId,email);
      }
    }
  });

  buttons.forEach(btn=>btn.addEventListener('click',e=>{
    e.preventDefault();
    Paddle.Checkout.open({
      items:[{priceId:config.priceId,quantity:1}],
      settings:{
        displayMode:'overlay',
        theme:'dark',
        locale:'en'
      },
      customData:{
        product:'list2sheet',
        product_id:config.productId
      }
    });
  }));
})();