const year=document.querySelector('[data-year]');
if(year) year.textContent=new Date().getFullYear();

let checkoutConfigCache=null;
let activeCheckoutConfig=null;

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
    showLicenseStatus('Payment verified. Copy this license into List2Sheet. Your purchase email is only needed if you ever recover the license.',data.license);
  }catch(error){
    showLicenseStatus('Payment succeeded, but automatic license delivery is not ready: '+error.message);
  }
}

async function loadCheckoutConfig({fresh=false}={}){
  if(!fresh&&checkoutConfigCache) return checkoutConfigCache;

  const response=await fetch('/api/checkout-config/',{cache:'no-store'});
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Checkout configuration is unavailable');

  checkoutConfigCache={...(window.RAINNIGHT_PADDLE||{}),...data};
  return checkoutConfigCache;
}

function renderPricingOffer(config){
  const kicker=document.querySelector('[data-price-kicker]');
  const value=document.querySelector('[data-price-value]');
  const detail=document.querySelector('[data-price-detail]');
  const buttons=document.querySelectorAll('[data-paddle-checkout]');

  if(config?.mode==='launch_limit'){
    if(config.offerActive){
      if(kicker) kicker.textContent='Early adopter offer · first 500 purchases';
      if(value) value.textContent='$19';
      if(detail) detail.textContent='One-time purchase · first 500 completed purchases · then $29 · no subscription';
      buttons.forEach(button=>button.textContent='Buy Pro — $19');
    }else{
      if(kicker) kicker.textContent='Standard price';
      if(value) value.textContent='$29';
      if(detail) detail.textContent='One-time purchase · no subscription';
      buttons.forEach(button=>button.textContent='Buy Pro — $29');
    }
    return;
  }

  if(config?.mode==='standard'){
    if(kicker) kicker.textContent='Standard price';
    if(value) value.textContent='$29';
    if(detail) detail.textContent='One-time purchase · no subscription';
    buttons.forEach(button=>button.textContent='Buy Pro — $29');
  }
}

function setCheckoutUnavailable(message){
  document.querySelectorAll('[data-paddle-checkout]').forEach(button=>{
    button.textContent='Checkout temporarily unavailable';
    button.dataset.checkoutUnavailable=message||'Checkout is temporarily unavailable. Please try again shortly.';
  });
}

(async function setupPaddle(){
  const buttons=document.querySelectorAll('[data-paddle-checkout]');
  if(!buttons.length) return;

  if(!window.Paddle){
    buttons.forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();
      alert('Paddle.js did not load. Please refresh and try again.');
    }));
    return;
  }

  let config;
  try{
    config=await loadCheckoutConfig();
    renderPricingOffer(config);
  }catch(error){
    setCheckoutUnavailable(error.message);
    buttons.forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();
      alert(btn.dataset.checkoutUnavailable||'Checkout is temporarily unavailable.');
    }));
    return;
  }

  if(!config.clientToken||!config.priceId){
    setCheckoutUnavailable('Checkout is not configured yet.');
    buttons.forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();
      alert(btn.dataset.checkoutUnavailable);
    }));
    return;
  }

  if(config.environment==='sandbox'){
    Paddle.Environment.set('sandbox');
  }else if(config.environment==='production'){
    Paddle.Environment.set('production');
  }

  Paddle.Initialize({
    token:config.clientToken,
    eventCallback:function(event){
      if(event?.name==='checkout.completed'){
        const transactionId=event.data?.transaction_id;
        const email=event.data?.customer?.email;
        if(transactionId&&email) requestLicense(transactionId,email);
      }

      if(event?.name==='checkout.error'&&activeCheckoutConfig?.discountId){
        checkoutConfigCache=null;
        loadCheckoutConfig({fresh:true})
          .then(next=>{
            renderPricingOffer(next);
            if(!next.offerActive){
              alert('The first-500 offer has just reached its limit. Pricing is now $29 one-time. Please click Buy Pro again.');
            }
          })
          .catch(()=>{});
      }
    }
  });

  buttons.forEach(btn=>btn.addEventListener('click',async e=>{
    e.preventDefault();

    try{
      // Refresh immediately before opening checkout so purchase 501 naturally
      // falls through to the standard $29 price.
      const latest=await loadCheckoutConfig({fresh:true});
      activeCheckoutConfig=latest;
      renderPricingOffer(latest);

      const checkout={
        items:[{priceId:latest.priceId,quantity:1}],
        settings:{
          displayMode:'overlay',
          theme:'dark',
          locale:'en',
          showAddDiscounts:false,
          allowDiscountRemoval:false
        },
        customData:{
          product:'list2sheet',
          product_id:latest.productId,
          launch_offer:latest.discountId?'first_500':'standard'
        }
      };

      if(latest.discountId) checkout.discountId=latest.discountId;
      Paddle.Checkout.open(checkout);
    }catch(error){
      alert('Checkout is temporarily unavailable while pricing is being verified. Please try again shortly.');
    }
  }));
})();

(function setupLicenseRecovery(){
  const form=document.querySelector('[data-license-recover]');
  if(!form) return;
  form.addEventListener('submit',async(e)=>{
    e.preventDefault();
    const transactionId=document.querySelector('[data-recover-transaction]')?.value?.trim();
    const email=document.querySelector('[data-recover-email]')?.value?.trim();
    if(!transactionId||!email) return;
    await requestLicense(transactionId,email);
  });
})();
