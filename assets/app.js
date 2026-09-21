const year=document.querySelector('[data-year]');
if(year) year.textContent=new Date().getFullYear();

let checkoutConfigCache=null;
let activeCheckoutConfig=null;
let completedCheckoutTransactionId=null;

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
    setTimeout(()=>box.scrollIntoView({behavior:'smooth',block:'center'}),50);
  }
}

function wait(ms){
  return new Promise(resolve=>setTimeout(resolve,ms));
}

async function requestLicense(transactionId,email){
  const maxAttempts=15;
  showLicenseStatus('Payment completed. Verifying the transaction and generating your List2Sheet license…');

  for(let attempt=1;attempt<=maxAttempts;attempt++){
    try{
      const response=await fetch('/api/license-issue/',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({transactionId,email})
      });
      const data=await response.json().catch(()=>({}));

      if(response.ok&&data.license){
        showLicenseStatus('Payment verified. Copy this license into List2Sheet. Your purchase email is only needed if you ever recover the license.',data.license);
        return;
      }

      // Paddle Checkout can finish a few seconds before the Transactions API
      // reports the transaction as completed. Retry briefly instead of making
      // the buyer recover the license manually.
      if(response.status===409&&data.error==='Transaction is not completed'&&attempt<maxAttempts){
        showLicenseStatus(`Payment received. Finalizing your license… (${attempt}/${maxAttempts})`);
        await wait(2000);
        continue;
      }

      throw new Error(data.error||'License generation failed');
    }catch(error){
      if(attempt<maxAttempts&&/network|fetch/i.test(String(error?.message||error))){
        showLicenseStatus(`Payment received. Retrying license delivery… (${attempt}/${maxAttempts})`);
        await wait(2000);
        continue;
      }

      showLicenseStatus(
        'Payment succeeded, but the license could not be delivered automatically yet. '+
        'Wait a moment, then use Recover license below with transaction '+transactionId+'.'
      );
      return;
    }
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

        if(transactionId&&email&&completedCheckoutTransactionId!==transactionId){
          completedCheckoutTransactionId=transactionId;

          // Paddle's green success screen lives inside the checkout overlay.
          // Our license is rendered by Rainnight Labs on the pricing page, so
          // close the overlay after successful payment before provisioning.
          try{ Paddle.Checkout.close(); }catch{}

          setTimeout(()=>{
            requestLicense(transactionId,email);
          },250);
        }
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
