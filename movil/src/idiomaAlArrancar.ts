import { aplicarIdioma, idiomaDelAparato } from '@compartido/idioma';

// PRIMERO DE TODO (14/10): el idioma del teléfono, antes de que cualquier
// pantalla se cargue y lea un texto. Va como primer import de la raíz.
aplicarIdioma(idiomaDelAparato());
