const express = require('express');
const cors = require('cors');
const https = require('https');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('.'));
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/index.html');
});

// LanguageTool API endpoint (completely free, no authentication)
const LANGUAGETOOL_API = 'https://api.languagetool.org/v2/check';

// Endpoint for grammar analysis
app.post('/api/analyze', async (req, res) => {
    const { text } = req.body;

    if (!text) {
        return res.status(400).json({ error: 'No text provided' });
    }

    try {
        // Call LanguageTool API
        const response = await fetch(LANGUAGETOOL_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                text: text,
                language: 'de', // German
                enabledOnly: 'false'
            })
        });

        if (!response.ok) {
            throw new Error('LanguageTool API error');
        }

        const data = await response.json();

        // Transform LanguageTool response to our format
        const issues = data.matches.map(match => ({
            word: text.substring(match.offset, match.offset + match.length),
            category: getCategoryFromMatch(match),
            currentForm: text.substring(match.offset, match.offset + match.length),
            correctForm: match.replacements.length > 0 ? match.replacements[0].value : 'N/A',
            explanation: match.message,
            rule: match.rule?.id || 'Unknown'
        }));

        // Calculate score (0-100)
        const issueCount = issues.length;
        const wordCount = text.split(/\s+/).length;
        const errorRate = Math.min(100, (issueCount / wordCount) * 100);
        const overallScore = Math.max(0, 100 - errorRate);

        res.json({
            issues: issues,
            overallScore: Math.round(overallScore),
            summary: `Found ${issueCount} issue${issueCount !== 1 ? 's' : ''} in your text.`
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Server error: ' + error.message });
    }
});

// Helper function to categorize errors
function getCategoryFromMatch(match) {
    const ruleId = match.rule?.id || '';
    const message = match.message.toLowerCase();

    if (ruleId.includes('CASE') || message.includes('case')) {
        return 'noun_case';
    }
    if (ruleId.includes('VERB') || message.includes('verb')) {
        return 'verb_conjugation';
    }
    if (ruleId.includes('ADJECTIVE') || ruleId.includes('ADJ') || message.includes('adjective')) {
        return 'adjective_declension';
    }
    if (ruleId.includes('ARTICLE') || message.includes('article')) {
        return 'article_agreement';
    }
    if (message.includes('spelling') || message.includes('spell')) {
        return 'spelling';
    }
    if (message.includes('comma') || message.includes('punctuation')) {
        return 'punctuation';
    }
    return 'grammar';
}

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'Deutsch4Me with LanguageTool' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Deutsch4Me backend running on port ${PORT}`);
    console.log(`Using LanguageTool API (free, no authentication needed)`);
});
