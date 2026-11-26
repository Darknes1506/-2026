export const materials = {
  water: {
    title: 'Гигиена воды',
    page: 12,
    section: 'Что изучает гигиена воды',
    excerpt: 'Качество воды и условия водоснабжения рассматриваются с точки зрения их влияния на здоровье человека.',
    context: 'В учебном разборе можно рассмотреть путь воды от источника до потребителя и обсудить, в каких точках этого пути оценивают её качество.',
    answer: [
      'Гигиена воды изучает, как качество воды и условия водоснабжения влияют на здоровье человека.',
    ],
    followUp: 'Например, на занятии можно нарисовать схему водоснабжения и отметить этапы, на которых уместно обсудить контроль качества воды.',
  },
  climate: {
    title: 'Микроклимат помещений',
    page: 8,
    section: 'Климат и микроклимат',
    excerpt: 'При описании микроклимата помещения рассматривают температуру воздуха, его влажность и скорость движения.',
    context: 'Для учебного сравнения удобно выбрать два помещения одного здания и описать условия в каждом, даже если на улице в этот момент одна и та же погода.',
    answer: [
      'Климат описывает многолетние погодные условия территории. Микроклимат описывает условия в небольшом пространстве, например в конкретной комнате.',
      'Для сравнения двух аудиторий можно обсудить температуру, влажность и движение воздуха в каждой из них.',
    ],
    followUp: 'Например, сравните аудиторию у солнечного фасада и аудиторию на теневой стороне. Сначала опишите каждое помещение, затем сравните наблюдения.',
  },
  study: {
    title: 'Подготовка к занятию по гигиене',
    page: 4,
    section: 'Вопросы для самопроверки',
    excerpt: 'Вопросы для самопроверки могут охватывать определение термина, пример его применения и разбор наблюдений.',
    context: 'Попробуйте ответить своими словами и для каждого ответа привести пример из учебной задачи.',
    answer: [
      'Попробуйте ответить на три вопроса для самопроверки:',
      '1. Что изучает гигиена воды?\n2. Какие параметры описывают микроклимат аудитории?\n3. Как сравнить условия в двух помещениях?',
    ],
    followUp: 'Для устного ответа попробуйте схему из трёх шагов: дайте определение, приведите пример и поясните, что в нём можно наблюдать.',
  },
};

const starterExamples = [
  {
    topic: 'water', icon: 'spark', title: 'Объяснить тему',
    prompt: 'Что изучает гигиена воды?',
  },
  {
    topic: 'climate', icon: 'layers', title: 'Сравнить понятия',
    prompt: 'Чем климат отличается от микроклимата?',
  },
  {
    topic: 'study', icon: 'list', title: 'Самопроверка',
    prompt: 'Составь вопросы по гигиене для самопроверки перед занятием.',
  },
];

export function initialChats() {
  return starterExamples.map(({ topic, prompt }) => ({
    id: `demo-${topic}`,
    title: topic === 'study' ? 'Подготовка к занятию' : materials[topic].title,
    messages: [
      { role: 'user', text: prompt },
      { role: 'assistant', paragraphs: materials[topic].answer, source: topic },
    ],
  }));
}

export function initialTemplates() {
  return starterExamples.map(({ topic, icon, title, prompt }) => ({ id: `demo-${topic}`, icon, title, prompt }));
}

export function demoReply(question, history = []) {
  const query = question.toLocaleLowerCase('ru');
  let topic;
  if (/самопроверк|подготов.{0,20}заняти|вопрос.{0,28}(?:заняти|зач[её]т)/.test(query)) topic = 'study';
  else if (/климат/.test(query)) topic = 'climate';
  else if (/(?:^|[^а-яё])вод(?:а|ы|е|у|ой|ою)(?:[^а-яё]|$)|водоснабжен/.test(query)) topic = 'water';

  if (topic) return { role: 'assistant', paragraphs: materials[topic].answer, source: topic };

  const followUp = /^(?:а )?(?:(?:можно )?подробнее|(?:расскажи|объясни) подробнее|уточни|приведи пример|какие (?:есть )?примеры|(?:как|зачем) это)/;
  const previousSource = history.findLast(({ role }) => role === 'assistant')?.source;
  if (followUp.test(query) && Object.hasOwn(materials, previousSource)) {
    return { role: 'assistant', paragraphs: [materials[previousSource].followUp], source: previousSource };
  }

  return {
    role: 'assistant',
    paragraphs: ['Для этого вопроса в демо нет готового ответа. Попробуйте спросить о гигиене воды, микроклимате или подготовке к занятию.'],
    source: null,
  };
}

export function materialUrl(source) {
  return `./material.html?topic=${encodeURIComponent(source)}#page-${materials[source].page}`;
}
