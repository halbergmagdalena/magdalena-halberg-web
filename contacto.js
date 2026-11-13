const EMAILJS_PUBLIC_KEY = "seTFN3N2EdtXbco91";
const EMAILJS_SERVICE_ID = "service_fp0r6o8";
const EMAILJS_TEMPLATE_ID = "template_4jatrmb";

const form = document.querySelector('#contact-form');
const note = document.querySelector('#form-note');
const submit = form.querySelector('button[type="submit"]');
const fields = [...form.querySelectorAll('[required]')];
const requiredMessages = {
  name: 'Ingresá tu nombre.',
  email: 'Ingresá tu email.',
  message: 'Escribí un mensaje.'
};
let sdk;

function loadEmailService() {
  if (!sdk) {
    sdk = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error('Tiempo de espera agotado'));
      }, 12000);
      script.onload = () => {
        clearTimeout(timeout);
        if (window.emailjs) resolve(window.emailjs);
        else reject(new Error('Servicio no disponible'));
      };
      script.onerror = () => {
        clearTimeout(timeout);
        script.remove();
        reject(new Error('Servicio no disponible'));
      };
      document.head.append(script);
    }).catch(error => {
      sdk = undefined;
      throw error;
    });
  }
  return sdk;
}

function validate(field) {
  let message = '';
  if (!field.value.trim()) message = requiredMessages[field.name];
  else if (field.validity.typeMismatch) message = 'Ingresá un email válido, por ejemplo nombre@estudio.com.';
  document.getElementById(field.getAttribute('aria-describedby')).textContent = message;
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  return !message;
}

for (const field of fields) {
  field.addEventListener('input', () => {
    if (field.hasAttribute('aria-invalid')) validate(field);
  });
}

let sending = false;
submit.disabled = false;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  const invalid = fields.filter(field => !validate(field));
  if (invalid.length) {
    note.textContent = 'Revisá los campos indicados.';
    invalid[0].focus();
    return;
  }
  const values = Object.fromEntries(new FormData(form));
  const params = {
    name: values.name.trim(),
    email: values.email.trim(),
    message: values.message.trim(),
    time: new Date().toLocaleString('es-AR')
  };
  sending = true;
  submit.setAttribute('aria-disabled', 'true');
  fields.forEach(field => field.readOnly = true);
  note.textContent = 'Enviando…';
  try {
    const email = await loadEmailService();
    await email.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, params, { publicKey: EMAILJS_PUBLIC_KEY });
    form.reset();
    note.textContent = '¡Mensaje enviado! Te voy a responder a la brevedad.';
  } catch {
    note.textContent = 'No pude enviar el mensaje. Probá de nuevo o escribime por email o WhatsApp.';
  } finally {
    sending = false;
    submit.removeAttribute('aria-disabled');
    fields.forEach(field => field.readOnly = false);
  }
});
