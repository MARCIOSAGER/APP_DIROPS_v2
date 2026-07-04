import { createEntity } from './_createEntity';

// Histórico versionado da taxa de câmbio USD→AOA.
// Nunca se edita uma vigência passada; cada mudança é uma nova linha
// (data_vigencia). A taxa de um voo é a vigente na sua data de operação
// (ver função SQL get_taxa_vigente / migração 047).
export const TaxaCambio = createEntity('taxa_cambio');
