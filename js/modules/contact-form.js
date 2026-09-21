// Lead form: validates, then sends the request to the company inbox through
// Web3Forms (a static site has no server of its own to send email from).
// The access key below is public by design — Web3Forms keys only ever let
// someone SUBMIT to the one address they were created for. Until a key is
// set the form falls back to opening the visitor's mail app with the same
// details pre-filled, so it is never a dead end.
var WEB3FORMS_ACCESS_KEY = 'cf5ec36b-a54b-401e-bbf3-7c8638628d53';
var TO_EMAIL = 'media@destexpert.com';
var ENDPOINT = 'https://api.web3forms.com/submit';

var ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
var PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

function normalizeDigits(value) {
  return value.replace(/[٠-٩۰-۹]/g, function (ch) {
    var i = ARABIC_DIGITS.indexOf(ch);
    return String(i === -1 ? PERSIAN_DIGITS.indexOf(ch) : i);
  });
}

export function initContactForm() {
  var form = document.getElementById('contactForm');
  if (!form) return;

  var card = document.getElementById('contactCard');
  var copy = document.getElementById('contactCopy');
  var success = document.getElementById('contactSuccess');
  var successText = document.getElementById('contactSuccessText');
  var status = form.querySelector('.contact-status');
  var submitBtn = form.querySelector('.contact-submit');
  var again = document.getElementById('contactAgain');
  var lang = document.documentElement.lang || 'ar';

  // Entrance reveal (one-shot).
  var revealTargets = [copy, card].filter(Boolean);
  if ('IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15 }
    );
    revealTargets.forEach(function (el) {
      revealObserver.observe(el);
    });
  } else {
    revealTargets.forEach(function (el) {
      el.classList.add('is-visible');
    });
  }

  var fields = ['name', 'phone', 'city', 'business'].map(function (key) {
    var wrap = form.querySelector('[data-field="' + key + '"]');
    return {
      key: key,
      wrap: wrap,
      input: wrap.querySelector('input'),
      error: wrap.querySelector('.field-error'),
      touched: false,
    };
  });

  function validate(field) {
    var value = field.input.value.trim();
    var ok = true;
    if (field.key === 'phone') {
      var digits = normalizeDigits(value).replace(/\D/g, '');
      ok = digits.length >= 8 && digits.length <= 15;
    } else {
      ok = value.length >= 2;
    }
    field.wrap.classList.toggle('has-error', !ok);
    field.input.setAttribute('aria-invalid', ok ? 'false' : 'true');
    field.error.textContent = ok ? '' : form.getAttribute('data-err-' + field.key) || '';
    return ok;
  }

  fields.forEach(function (field) {
    field.input.addEventListener('blur', function () {
      field.touched = true;
      validate(field);
    });
    field.input.addEventListener('input', function () {
      if (field.touched) validate(field);
    });
  });

  // Business-type suggestion chips fill the field; typing anything else just
  // un-highlights them.
  var chips = Array.prototype.slice.call(form.querySelectorAll('.contact-chip'));
  var businessField = fields[3];
  function syncChips() {
    var current = businessField.input.value.trim();
    chips.forEach(function (chip) {
      chip.classList.toggle('is-active', chip.getAttribute('data-value') === current);
    });
  }
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      var value = chip.getAttribute('data-value');
      businessField.input.value = value || '';
      businessField.touched = true;
      validate(businessField);
      syncChips();
      if (!value) businessField.input.focus();
    });
  });
  businessField.input.addEventListener('input', syncChips);

  function setStatus(html, isError) {
    status.innerHTML = html;
    status.classList.toggle('is-error', !!isError);
  }

  function setSending(sending) {
    form.classList.toggle('is-sending', sending);
    submitBtn.disabled = sending;
  }

  function showSuccess(text) {
    if (text && successText) successText.textContent = text;
    form.hidden = true;
    success.hidden = false;
  }

  function buildMailto(data) {
    var subject = form.getAttribute('data-mail-subject') || 'New request';
    var body = [
      form.getAttribute('data-label-name') + ': ' + data.name,
      form.getAttribute('data-label-phone') + ': ' + data.phone,
      form.getAttribute('data-label-city') + ': ' + data.city,
      form.getAttribute('data-label-business') + ': ' + data.business,
    ].join('\n');
    return 'mailto:' + TO_EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (submitBtn.disabled) return;

    var allOk = true;
    fields.forEach(function (field) {
      field.touched = true;
      if (!validate(field)) allOk = false;
    });
    if (!allOk) {
      var firstBad = fields.filter(function (f) {
        return f.wrap.classList.contains('has-error');
      })[0];
      if (firstBad) firstBad.input.focus();
      return;
    }

    // Honeypot: a filled hidden checkbox means a bot — pretend it worked.
    if (form.elements.botcheck && form.elements.botcheck.checked) {
      showSuccess();
      return;
    }

    var data = {
      name: fields[0].input.value.trim(),
      phone: normalizeDigits(fields[1].input.value.trim()),
      city: fields[2].input.value.trim(),
      business: fields[3].input.value.trim(),
    };

    setStatus('', false);

    if (!WEB3FORMS_ACCESS_KEY) {
      window.location.href = buildMailto(data);
      showSuccess(form.getAttribute('data-msg-mailto'));
      return;
    }

    setSending(true);
    setStatus(form.getAttribute('data-msg-sending') || '', false);

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: WEB3FORMS_ACCESS_KEY,
        subject: form.getAttribute('data-mail-subject') || 'New request',
        from_name: 'TDX Website',
        page_language: lang,
        name: data.name,
        phone: data.phone,
        city: data.city,
        business: data.business,
        botcheck: '',
      }),
    })
      .then(function (res) {
        return res.json().then(function (json) {
          return { ok: res.ok && json && json.success, json: json };
        });
      })
      .then(function (result) {
        setSending(false);
        if (!result.ok) throw new Error('send failed');
        setStatus('', false);
        showSuccess();
      })
      .catch(function () {
        setSending(false);
        setStatus(form.getAttribute('data-msg-error') || 'Something went wrong.', true);
      });
  });

  if (again) {
    again.addEventListener('click', function () {
      form.reset();
      fields.forEach(function (field) {
        field.touched = false;
        field.wrap.classList.remove('has-error');
        field.error.textContent = '';
        field.input.removeAttribute('aria-invalid');
      });
      syncChips();
      setStatus('', false);
      success.hidden = true;
      form.hidden = false;
      fields[0].input.focus();
    });
  }
}
