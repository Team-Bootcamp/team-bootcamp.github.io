import React, {useEffect, useMemo, useState} from 'react';
import algoliasearch from 'algoliasearch/lite';
import {
  Configure,
  HierarchicalMenu,
  Hits,
  InstantSearch,
  Pagination,
  SearchBox,
  Stats
} from 'react-instantsearch';

const searchClient = algoliasearch(
  'LT69QYN2X7',
  '172a3701f70093164abe578270b2ab0b'
);

const ATTRIBUTE_OPTIONS = [
  {label: 'Prompt', value: 'prompt'},
  {label: 'Answers', value: 'answers'},
  {label: 'Explanation', value: 'explanation'},
  {label: 'Hyperlinks', value: 'hyperlinks'},
  {label: 'Question Header', value: 'questionHeader'},
  {label: 'Meta', value: 'meta'}
];

const DEFAULT_ATTRIBUTES = ['prompt', 'answers', 'explanation'];
const SNIPPET_LENGTHS = {
  prompt: 30,
  answers: 12,
  explanation: 30,
  hyperlinks: 12,
  questionHeader: 18,
  meta: 20
};

const FALLBACK_SNIPPET_LENGTHS = {
  prompt: 240,
  answers: 140,
  explanation: 240,
  hyperlinks: 140,
  questionHeader: 180,
  meta: 200
};

const IMAGE_ATTRIBUTES = [
  {key: 'questionHeader', label: 'Question Header'},
  {key: 'prompt', label: 'Prompt'},
  {key: 'answers', label: 'Answers'},
  {key: 'explanation', label: 'Explanation'},
  {key: 'hyperlinks', label: 'Hyperlinks'},
  {key: 'meta', label: 'Meta'}
];
const RELATIVE_IMAGE_BASE = 'https://admin.bootcamp.com';

const escapeHtml = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');

const stripHtml = (value) =>
  String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

const truncateText = (value, maxLength) => {
  if (!value) return '';
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}…`;
};

const normalizeToList = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (value === null || value === undefined || value === '') return [];
  return [value];
};

const normalizeSelection = (values) => {
  const order = ATTRIBUTE_OPTIONS.map(({value}) => value);
  return order.filter((value) => values.includes(value));
};

const getSnippetValue = (hit, attribute) => {
  const result = hit?._snippetResult?.[attribute];
  if (!result) return null;
  if (Array.isArray(result)) {
    return result
      .map((item) => item?.value)
      .filter((value) => typeof value === 'string' && value.length > 0);
  }
  if (typeof result?.value === 'string') return result.value;
  return null;
};

const getHighlightValue = (hit, attribute) => {
  const result = hit?._highlightResult?.[attribute];
  if (!result) return null;
  if (Array.isArray(result)) {
    return result
      .map((item) => item?.value)
      .filter((value) => typeof value === 'string' && value.length > 0);
  }
  if (typeof result?.value === 'string') return result.value;
  return null;
};

const normalizeAnswerValue = (answer) => {
  if (Array.isArray(answer)) return answer[0];
  if (answer && typeof answer === 'object' && 'text' in answer) return answer.text;
  return answer;
};

const normalizeHyperlinkValue = (link) => {
  if (typeof link === 'string') return link;
  if (link && typeof link === 'object') {
    return link.url || link.href || link.link || '';
  }
  return '';
};

const pickHtmlValue = (attribute, snippetValue, highlightValue, rawValue) => {
  const snippet = Array.isArray(snippetValue) ? snippetValue[0] : snippetValue;
  if (snippet) return snippet;
  const highlight = Array.isArray(highlightValue) ? highlightValue[0] : highlightValue;
  if (highlight) return highlight;
  if (rawValue === null || rawValue === undefined || rawValue === '') return null;
  const maxLength = FALLBACK_SNIPPET_LENGTHS[attribute] || 200;
  const trimmed = truncateText(stripHtml(rawValue), maxLength);
  return escapeHtml(trimmed);
};

const pickHtmlListValues = (attribute, snippetValue, highlightValue, rawValues) => {
  const snippetList = normalizeToList(snippetValue);
  if (snippetList.length > 0) return snippetList;
  const highlightList = normalizeToList(highlightValue);
  if (highlightList.length > 0) return highlightList;
  const maxLength = FALLBACK_SNIPPET_LENGTHS[attribute] || 160;
  return normalizeToList(rawValues).map((value) =>
    escapeHtml(truncateText(stripHtml(value), maxLength))
  );
};

const extractImageSourcesFromString = (value) => {
  if (!value || typeof value !== 'string') return [];
  const sources = new Set();
  const normalizeImageSrc = (src) => {
    if (!src || typeof src !== 'string') return null;
    const trimmed = src.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return trimmed;
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    if (trimmed.startsWith('//')) return `https:${trimmed}`;
    if (trimmed.startsWith('/')) return `${trimmed}`;
    // escape string
    if (trimmed.startsWith('\\')) {
      // remove backslashes
      return trimmed.replace(/\\"/g, '');
    };
    return `${trimmed}`;
  };
  try {
    const doc = new DOMParser().parseFromString(value, 'text/html');
    doc.querySelectorAll('img').forEach((img) => {
      const rawSrc = img.getAttribute('src');
      const normalizedSrc = normalizeImageSrc(rawSrc);
      if (normalizedSrc) sources.add(normalizedSrc);
    });
  } catch (error) {
    // no-op fallback to regex below
  }
  const regex = /https?:\/\/[^"'\\s)]+?\\.(?:png|jpe?g|gif|webp|svg)/gi;
  const matches = value.match(regex) || [];
  matches.forEach((match) => {
    const normalizedSrc = normalizeImageSrc(match);
    if (normalizedSrc) sources.add(normalizedSrc);
  });
  return Array.from(sources);
};

const collectImageSources = (values) => {
  const sources = new Set();
  normalizeToList(values).forEach((value) => {
    extractImageSourcesFromString(value).forEach((src) => sources.add(src));
  });
  return Array.from(sources);
};

const HitCard = ({hit, onOpenLightbox}) => {
  const promptSnippet = getSnippetValue(hit, 'prompt');
  const headerSnippet = getSnippetValue(hit, 'questionHeader');
  const answersSnippet = getSnippetValue(hit, 'answers');
  const explanationSnippet = getSnippetValue(hit, 'explanation');
  const hyperlinksSnippet = getSnippetValue(hit, 'hyperlinks');
  const metaSnippet = getSnippetValue(hit, 'meta');

  const promptHighlight = getHighlightValue(hit, 'prompt');
  const headerHighlight = getHighlightValue(hit, 'questionHeader');
  const answersHighlight = getHighlightValue(hit, 'answers');
  const explanationHighlight = getHighlightValue(hit, 'explanation');
  const hyperlinksHighlight = getHighlightValue(hit, 'hyperlinks');
  const metaHighlight = getHighlightValue(hit, 'meta');

  const fallbackAnswers = Array.isArray(hit.answers)
    ? hit.answers.map(normalizeAnswerValue).filter(Boolean)
    : [];

  const hyperlinks = Array.isArray(hit.hyperlinks)
    ? hit.hyperlinks.map(normalizeHyperlinkValue).filter(Boolean)
    : hit.hyperlinks
      ? [normalizeHyperlinkValue(hit.hyperlinks)].filter(Boolean)
      : [];

  const headerHtml = pickHtmlValue('questionHeader', headerSnippet, headerHighlight, hit.questionHeader);
  const promptHtml = pickHtmlValue('prompt', promptSnippet, promptHighlight, hit.prompt);
  const explanationHtml = pickHtmlValue('explanation', explanationSnippet, explanationHighlight, hit.explanation);
  const metaHtml = pickHtmlValue('meta', metaSnippet, metaHighlight, hit.meta);

  const answersHtmlList = pickHtmlListValues('answers', answersSnippet, answersHighlight, fallbackAnswers);
  const hyperlinksHtmlList = pickHtmlListValues('hyperlinks', hyperlinksSnippet, hyperlinksHighlight, hyperlinks);

  const imageGroups = IMAGE_ATTRIBUTES.map(({key, label}) => {
    let values = [];
    if (key === 'answers') {
      values = fallbackAnswers;
    } else if (key === 'hyperlinks') {
      values = hyperlinks;
    } else if (hit[key]) {
      values = [hit[key]];
    }
    const sources = collectImageSources(values);
    if (sources.length === 0) return null;
    return {label, sources};
  }).filter(Boolean);

  return (
    <article className="hit-card">
      <div className="hit-header">
        <div className="hit-id">ID: {hit.objectID}</div>
        <a
          className="hit-link"
          href={`https://admin.bootcamp.com/questions/${hit.objectID}`}
          target="_blank"
          rel="noreferrer"
        >
          Open in Admin
        </a>
      </div>
      {headerHtml && (
        <div
          className="hit-header-text fr-view"
          dangerouslySetInnerHTML={{__html: headerHtml}}
        />
      )}
      {promptHtml && (
        <div
          className="hit-prompt fr-view"
          dangerouslySetInnerHTML={{__html: promptHtml}}
        />
      )}
      <div className="hit-section">
        <div className="hit-section-title">Answers</div>
        {answersHtmlList.length > 0 ? (
          <div className="hit-list">
            {answersHtmlList.map((answer, index) => (
              <div
                key={`${hit.objectID}-answer-${index}`}
                dangerouslySetInnerHTML={{__html: answer}}
              />
            ))}
          </div>
        ) : (
          <div className="hit-muted">No answers in this record.</div>
        )}
      </div>
      {explanationHtml && (
        <div className="hit-section">
          <div className="hit-section-title">Explanation</div>
          <div className="hit-text fr-view" dangerouslySetInnerHTML={{__html: explanationHtml}} />
        </div>
      )}
      {metaHtml && (
        <div className="hit-section">
          <div className="hit-section-title">Meta</div>
          <div className="hit-text fr-view" dangerouslySetInnerHTML={{__html: metaHtml}} />
        </div>
      )}
      {imageGroups.length > 0 && (
        <div className="hit-section">
          <div className="hit-section-title">Images</div>
          <div className="image-groups">
            {imageGroups.map(({label, sources}) => (
              <div key={`${hit.objectID}-${label}`} className="image-group">
                <div className="image-group-label">{label}</div>
                <div className="image-grid">
                  {sources.map((src, index) => (
                    <button
                      key={`${hit.objectID}-${label}-${index}`}
                      type="button"
                      className="image-button"
                      onClick={() => onOpenLightbox({src, label})}
                    >
                      <img src={src} alt={`${label} image`} loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
};

const App = () => {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'light';
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });
  const [selectedAttributes, setSelectedAttributes] = useState(DEFAULT_ATTRIBUTES);
  const [lightbox, setLightbox] = useState(null);
  const [collapsedSections, setCollapsedSections] = useState({
    fields: false,
    tags: false
  });
  const allAttributes = useMemo(
    () => ATTRIBUTE_OPTIONS.map(({value}) => value),
    []
  );
  const attributesToSnippet = useMemo(
    () =>
      Object.entries(SNIPPET_LENGTHS).map(
        ([attribute, length]) => `${attribute}:${length}`
      ),
    []
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!lightbox) return;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setLightbox(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightbox]);

  const toggleAttribute = (value) => {
    setSelectedAttributes((prev) => {
      if (prev.includes(value)) {
        return prev.filter((item) => item !== value);
      }
      return normalizeSelection([...prev, value]);
    });
  };

  const selectAll = () => setSelectedAttributes(allAttributes);
  const resetToDefault = () => setSelectedAttributes(DEFAULT_ATTRIBUTES);
  const clearAll = () => setSelectedAttributes([]);
  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  const openLightbox = ({src, label}) => setLightbox({src, label});
  const closeLightbox = () => setLightbox(null);
  const toggleSection = (key) => {
    setCollapsedSections((prev) => ({...prev, [key]: !prev[key]}));
  };

  const restrictedAttributes =
    selectedAttributes.length > 0 ? selectedAttributes : undefined;

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-topline">Algolia + Bootcamp Admin</div>
        <div className="hero-meta">
          <span>Index: question_objects</span>
          <span>App ID: LT69QYN2X7</span>
        </div>
      </header>

      <InstantSearch searchClient={searchClient} indexName="question_objects">
        <Configure
          hitsPerPage={12}
          restrictSearchableAttributes={restrictedAttributes}
          attributesToSnippet={attributesToSnippet}
          snippetEllipsisText="…"
          highlightPreTag="<mark>"
          highlightPostTag="</mark>"
        />
        <main className="app-layout">
          <aside className="panel">
            <div className={`panel-section ${collapsedSections.fields ? 'panel-section--collapsed' : ''}`}>
              <button
                type="button"
                className="panel-section-toggle"
                onClick={() => toggleSection('fields')}
                aria-expanded={!collapsedSections.fields}
              >
                <span>Searchable Fields</span>
                <span className="panel-section-icon">{collapsedSections.fields ? '+' : '-'}</span>
              </button>
              <div className="panel-section-body" hidden={collapsedSections.fields}>
                <div className="button-row">
                  <button type="button" onClick={selectAll}>
                    Select all
                  </button>
                  <button type="button" onClick={resetToDefault}>
                    Reset
                  </button>
                  <button type="button" onClick={clearAll} className="ghost">
                    Clear
                  </button>
                </div>
                <div className="field-grid">
                  {ATTRIBUTE_OPTIONS.map(({label, value}) => (
                    <label key={value} className="field-option">
                      <input
                        type="checkbox"
                        checked={selectedAttributes.includes(value)}
                        onChange={() => toggleAttribute(value)}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                <div className="active-fields">
                  <span>Active:</span>
                  {selectedAttributes.length > 0 ? (
                    selectedAttributes.map((value) => (
                      <span key={value} className="chip">
                        {value}
                      </span>
                    ))
                  ) : (
                    <span className="chip muted">All fields</span>
                  )}
                </div>
              </div>
            </div>
            <div className={`panel-section ${collapsedSections.tags ? 'panel-section--collapsed' : ''}`}>
              <button
                type="button"
                className="panel-section-toggle"
                onClick={() => toggleSection('tags')}
                aria-expanded={!collapsedSections.tags}
              >
                <span>Tag Categories</span>
                <span className="panel-section-icon">{collapsedSections.tags ? '+' : '-'}</span>
              </button>
              <div className="panel-section-body" hidden={collapsedSections.tags}>
                <p>Filter by test &gt; subject &gt; topic.</p>
                <HierarchicalMenu
                  attributes={[
                    'tag_categories.tests',
                    'tag_categories.subjects',
                    'tag_categories.topics'
                  ]}
                  limit={100}
                  showMoreLimit={1000}
                  sortBy={["count"]}
                />
              </div>
            </div>
            <div className="panel-spacer" />
            <button type="button" className="theme-toggle" onClick={toggleTheme}>
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </aside>

          <section className="results">
            <div className="results-header">
              <SearchBox placeholder="Search Bootcamp questions..." autoFocus  />
              <Stats />
            </div>
            <Hits hitComponent={({hit}) => (
              <HitCard hit={hit} onOpenLightbox={openLightbox} />
            )} />
            <Pagination padding={2} />
          </section>
        </main>
      </InstantSearch>
      {lightbox && (
        <div className="lightbox" onClick={closeLightbox}>
          <div
            className="lightbox-content"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lightbox-header">
              <div className="lightbox-title">{lightbox.label || 'Image'}</div>
              <button type="button" className="lightbox-close" onClick={closeLightbox}>
                Close
              </button>
            </div>
            <img src={lightbox.src} alt={lightbox.label || 'Image'} />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
