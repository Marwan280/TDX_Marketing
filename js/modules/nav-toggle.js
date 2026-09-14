// Mobile-only hamburger -> slide-in sidebar (see the max-width: 768px block
// in header.css; on desktop .nav-toggle is display: none and this just has
// nothing to toggle). The backdrop and a click on any link both close it —
// without the link-click close, navigating from the menu would leave it
// sitting open over the section you just jumped to.
export function initNavToggle() {
  var toggle = document.getElementById('navToggle');
  var nav = document.getElementById('mainNav');
  var backdrop = document.getElementById('navBackdrop');
  if (!toggle || !nav) return;

  function setOpen(open) {
    toggle.classList.toggle('is-open', open);
    nav.classList.toggle('is-open', open);
    if (backdrop) backdrop.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  toggle.addEventListener('click', function () {
    setOpen(!nav.classList.contains('is-open'));
  });

  if (backdrop) {
    backdrop.addEventListener('click', function () {
      setOpen(false);
    });
  }

  Array.prototype.forEach.call(nav.querySelectorAll('a'), function (link) {
    link.addEventListener('click', function () {
      setOpen(false);
    });
  });
}
