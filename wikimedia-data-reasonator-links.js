/*
 * Wikidata and Reasonator Navigation Links
 * Author: https://github.com/annie-things
 * thanks to: https://github.com/maxlath/wikidata-links-enhancer
 */

(function() {
    'use strict';

    // Only run on content pages
    if (mw.config.get('wgNamespaceNumber') < 0) return;

    // Add styles
    mw.loader.addStyleTag(`
        .wikidata-links {
            font-size: 0.9em;
            margin: 0.5em 0;
            color: #54595d;
        }
        .wikidata-links a {
            margin: 0 2px;
        }
        .wikidata-links .separator {
            margin: 0 1px;
            color: #a2a9b1;
        }
        .wikidata-links hr {
            margin: 0.3em 0;
            border: none;
            border-top: 1px solid #eaecf0;
        }
    `);

    // Helper function to format page titles
    function formatPageTitle(title) {
        return title.replace(/_/g, ' ');
    }

    function getWikidataEntity() {
        // For Wikidata pages
        if (mw.config.get('wgDBname') === 'wikidatawiki') {
            const pageTitle = mw.config.get('wgPageName');
            if (pageTitle.match(/^Q\d+$/)) {
                return pageTitle;
            }
            return null;
        }

        // For Commons files
        if (mw.config.get('wgDBname') === 'commonswiki' && mw.config.get('wgNamespaceNumber') === 6) {
            return getCommonsWikidataItems();
        }

        // For Wikipedia and other projects
        const $wikibaseLink = $('#t-wikibase a');
        if ($wikibaseLink.length) {
            const href = $wikibaseLink.attr('href');
            const match = href.match(/\/wiki\/(Q\d+)$/);
            return match ? match[1] : null;
        }

        return null;
    }

    async function getCommonsWikidataItems() {
        const filename = mw.config.get('wgPageName').replace(/^File:/, '');
        const items = {
            depicts: [],
            usage: []
        };

        try {
            // Get depicts statements (P180)
            const depictsResponse = await $.get(
                'https://commons.wikimedia.org/w/api.php',
                {
                    action: 'wbgetentities',
                    sites: 'commonswiki',
                    titles: 'File:' + filename,
                    format: 'json',
                    origin: '*'
                }
            );

            const entity = Object.values(depictsResponse.entities)[0];
            if (entity && entity.statements && entity.statements.P180) {
                items.depicts = entity.statements.P180
                    .map(statement => statement.mainsnak.datavalue?.value.id)
                    .filter(id => id && id.startsWith('Q'));
            }

            // Get Wikipedia usage
            const usageResponse = await $.get(
                'https://commons.wikimedia.org/w/api.php',
                {
                    action: 'query',
                    prop: 'globalusage',
                    titles: 'File:' + filename,
                    gusite: 'enwiki',
                    gunamespace: '0',
                    format: 'json',
                    origin: '*'
                }
            );

            const pages = Object.values(usageResponse.query.pages)[0];
            if (pages.globalusage) {
                const wikiTitles = pages.globalusage.map(usage => usage.title);
                
                // Get Wikidata IDs for the Wikipedia pages
                for (const title of wikiTitles) {
                    const wikiResponse = await $.get(
                        'https://en.wikipedia.org/w/api.php',
                        {
                            action: 'query',
                            prop: 'pageprops',
                            titles: title,
                            format: 'json',
                            origin: '*'
                        }
                    );
                    
                    const wikiPages = Object.values(wikiResponse.query.pages)[0];
                    if (wikiPages.pageprops && wikiPages.pageprops.wikibase_item) {
                        items.usage.push({
                            id: wikiPages.pageprops.wikibase_item,
                            title: formatPageTitle(title)
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching Wikidata items:', error);
        }

        return items;
    }

    function createLinks(entity) {
        const $container = $('<div>').addClass('wikidata-links');
        
        if (typeof entity === 'string' && entity.startsWith('Q')) {
            // Single entity (Wikipedia/Wikidata pages)
            $container.append(
                $('<a>')
                    .attr('href', 'https://www.wikidata.org/wiki/' + entity)
                    .text('Wikidata'),
                $('<span>').addClass('separator').text('◊'),
                $('<a>')
                    .attr('href', 'https://reasonator.toolforge.org/?q=' + entity + '&lang=en')
                    .text('Reasonator')
            );
        } else if (typeof entity === 'object') {
            // Commons file with multiple items
            if (entity.depicts.length) {
                const $depictsSection = $('<div>').text('Depicts: ');
                entity.depicts.forEach((id, index) => {
                    if (index > 0) $depictsSection.append($('<span>').addClass('separator').text('◊'));
                    $depictsSection.append(
                        $('<a>')
                            .attr('href', 'https://www.wikidata.org/wiki/' + id)
                            .text('Wikidata'),
                        $('<span>').addClass('separator').text('◊'),
                        $('<a>')
                            .attr('href', 'https://reasonator.toolforge.org/?q=' + id + '&lang=en')
                            .text('Reasonator')
                    );
                });
                $container.append($depictsSection);
            }

            if (entity.usage.length) {
                const $usageSection = $('<div>').text('Used in: ');
                entity.usage.forEach((item, index) => {
                    if (index > 0) $usageSection.append($('<span>').addClass('separator').text('◊'));
                    $usageSection.append(
                        $('<span>').text(item.title + ' ('),
                        $('<a>')
                            .attr('href', 'https://www.wikidata.org/wiki/' + id)
                            .text('Wikidata'),
                        $('<span>').addClass('separator').text('◊'),
                        $('<a>')
                            .attr('href', 'https://reasonator.toolforge.org/?q=' + id + '&lang=en')
                            .text('Reasonator'),
                        $('<span>').text(')')
                    );
                });
                if (entity.depicts.length) {
                    $container.append($('<hr>'));
                }
                $container.append($usageSection);
            }
        }

        return $container;
    }

    async function init() {
        const entity = await getWikidataEntity();
        if (!entity) return;

        const $links = createLinks(entity);
        const $firstHeading = $('#firstHeading, .firstHeading');
        if ($firstHeading.length) {
            $firstHeading.after($links);
        }
    }

    // Run the script when the page is ready
    $(init);
})();