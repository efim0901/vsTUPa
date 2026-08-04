document.addEventListener('DOMContentLoaded', function () {
  var burger = document.getElementById('burgerBtn');
  var nav = document.querySelector('.mainnav');
  if (!burger || !nav) return;

  burger.addEventListener('click', function () {
    var open = nav.classList.toggle('mainnav--open');
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
});
