const year=document.querySelector('[data-year]');
if(year) year.textContent=new Date().getFullYear();

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
  Paddle.Initialize({token:config.clientToken});

  buttons.forEach(btn=>btn.addEventListener('click',e=>{
    e.preventDefault();
    Paddle.Checkout.open({
      items:[{priceId:config.priceId,quantity:1}],
      settings:{
        displayMode:'overlay',
        theme:'dark',
        locale:'en',
        successUrl:'https://rainnightlabs.com/pricing/?checkout=success'
      },
      customData:{
        product:'list2sheet',
        product_id:config.productId
      }
    });
  }));
})();