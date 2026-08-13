param(
  [Parameter(Mandatory = $true)]
  [string]$SourceDocx,
  [string]$OutputJson = '',
  [string]$AuditJson = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem

if (-not $OutputJson) { $OutputJson = Join-Path $PSScriptRoot '..\src\data\en-vi-word-topics.json' }
if (-not $AuditJson) { $AuditJson = Join-Path $PSScriptRoot '..\docs\word-topic-import-audit.json' }

function Normalize-Line([string]$Value) {
  return (($Value -replace [char]0x00A0, ' ') -replace '\s+', ' ').Trim()
}

function Clean-Meaning([string]$Value) {
  $clean = (Normalize-Line $Value) -replace '^[\s:;,.–—-]+', ''
  if ($clean.Length -gt 300) { return $clean.Substring(0, 297).TrimEnd() + '...' }
  return $clean
}

function Split-TopicTitle([string]$Heading) {
  $name = ($Heading -replace '(?i)^CHỦ ĐỀ\s+[0-9.]+\s*[:.]?\s*', '').Trim().TrimEnd(':')
  $english = ''
  if ($name -match '^(?<vi>.+?)\s*\((?<en>[^()]*)\)\s*$') {
    $name = $Matches.vi.Trim()
    $english = $Matches.en.Trim()
  }
  return @{ Vietnamese = $name; English = $english }
}

function Parse-Card([string]$Text, [int]$Order) {
  $line = Normalize-Line $Text
  $term = ''
  $pronunciation = ''
  $partOfSpeech = ''
  $meaning = ''

  if ($line -match '^Tea\s*/(?<pron>[^/]+)/\s*$') {
    return [ordered]@{ term = 'Tea'; meaning = 'Trà'; pronunciation = $Matches.pron.Trim(); example = ''; imageUrl = ''; partOfSpeech = 'noun'; sourceOrder = $Order }
  }
  if ($line -match '^Water\s*/(?<pron>[^/]+)/\s*$') {
    return [ordered]@{ term = 'Water'; meaning = 'Nước'; pronunciation = $Matches.pron.Trim(); example = ''; imageUrl = ''; partOfSpeech = 'noun'; sourceOrder = $Order }
  }

  $slashMatch = [regex]::Match($line, '^(?<term>.+?)\s*(?:–|—|-)?\s*/(?<pron>[^/]{1,120})/\s*(?<rest>.+)$')
  if ($slashMatch.Success) {
    $term = Normalize-Line $slashMatch.Groups['term'].Value
    $pronunciation = Normalize-Line $slashMatch.Groups['pron'].Value
    $rest = Normalize-Line $slashMatch.Groups['rest'].Value
    if ($term -match '^(?<word>.*?)\s*\((?<pos>[^)]+)\)\s*$') {
      $term = $Matches.word.Trim()
      $partOfSpeech = $Matches.pos.Trim().ToLowerInvariant()
    }
    if ($rest -match '^\((?<pos>[^)]+)\)\s*:?[\s]*(?<meaning>.+)$') {
      if (-not $partOfSpeech) { $partOfSpeech = $Matches.pos.Trim().ToLowerInvariant() }
      $meaning = Clean-Meaning $Matches.meaning
    } else {
      $meaning = Clean-Meaning $rest
    }
  } else {
    $delimiterMatch = [regex]::Match($line, '^(?<term>.{1,120}?)\s*(?:=>|:|;)\s*(?<meaning>.+)$')
    if ($delimiterMatch.Success) {
      $term = Normalize-Line $delimiterMatch.Groups['term'].Value
      $meaning = Clean-Meaning $delimiterMatch.Groups['meaning'].Value
      if ($term -match '^(?<word>.*?)\s*\((?<pos>[^)]+)\)\s*$') {
        $term = $Matches.word.Trim()
        $partOfSpeech = $Matches.pos.Trim().ToLowerInvariant()
      }
    } else {
      $posMatch = [regex]::Match($line, "^(?<term>[A-Za-z][A-Za-z '’/–—-]{0,90}?)\s*\((?<pos>n|v|adj|adv|noun|verb|adjective|adverb)\)\s+(?<meaning>.+)$", 'IgnoreCase')
      if ($posMatch.Success) {
        $term = Normalize-Line $posMatch.Groups['term'].Value
        $partOfSpeech = $posMatch.Groups['pos'].Value.Trim().ToLowerInvariant()
        $meaning = Clean-Meaning $posMatch.Groups['meaning'].Value
      } elseif ($line -match '^(?<term>Width)\s+(?<pron>[^/]+)/\s*(?<meaning>.+)$') {
        $term = $Matches.term
        $pronunciation = $Matches.pron.Trim()
        $meaning = Clean-Meaning $Matches.meaning
      } else {
        return $null
      }
    }
  }

  $term = ($term -replace '^[\s•·–—-]+|[\s:;,.–—-]+$', '').Trim()
  if (-not $term -or -not $meaning -or $term.Length -gt 100 -or $term -match '(?i)https?://') { return $null }

  return [ordered]@{
    term = $term
    meaning = $meaning
    pronunciation = $pronunciation
    example = ''
    imageUrl = ''
    partOfSpeech = $partOfSpeech
    sourceOrder = $Order
  }
}

$resolvedSource = (Resolve-Path -LiteralPath $SourceDocx).Path
$zip = [System.IO.Compression.ZipFile]::OpenRead($resolvedSource)
try {
  $entry = $zip.GetEntry('word/document.xml')
  if (-not $entry) { throw 'Không tìm thấy word/document.xml trong DOCX.' }
  $reader = [IO.StreamReader]::new($entry.Open())
  try { [xml]$xml = $reader.ReadToEnd() } finally { $reader.Dispose() }
} finally {
  $zip.Dispose()
}

$ns = [Xml.XmlNamespaceManager]::new($xml.NameTable)
$ns.AddNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main')
$lines = @($xml.SelectNodes('//w:body/w:p', $ns) | ForEach-Object {
  Normalize-Line (($_.SelectNodes('.//w:t', $ns) | ForEach-Object InnerText) -join '')
} | Where-Object { $_ })

$categories = [Collections.Generic.List[object]]::new()
$unparsed = [Collections.Generic.List[object]]::new()
$currentCategory = $null
$currentTopic = $null
$topicOrder = 0
$sourceOrder = 0

foreach ($line in $lines) {
  if ($line -match '^\d+\.\s*[A-ZÀ-Ỹ][A-ZÀ-Ỹ\s&]+$') {
    $currentCategory = [ordered]@{
      id = 'category-{0:d2}' -f ($categories.Count + 1)
      order = $categories.Count + 1
      title = ($line -replace '^\d+\.\s*', '').Trim()
      topics = [Collections.Generic.List[object]]::new()
    }
    $categories.Add($currentCategory)
    $currentTopic = $null
    continue
  }

  if ($line -match '(?i)^CHỦ ĐỀ\s+[0-9.]+\s*[:.]') {
    if (-not $currentCategory) {
      $currentCategory = [ordered]@{ id = 'category-01'; order = 1; title = 'TỔNG HỢP'; topics = [Collections.Generic.List[object]]::new() }
      $categories.Add($currentCategory)
    }
    $topicOrder += 1
    $parts = Split-TopicTitle $line
    $sourceNumber = if ($line -match '(?i)^CHỦ ĐỀ\s+(?<number>[0-9.]+)') { $Matches.number } else { '' }
    $currentTopic = [ordered]@{
      id = 'topic-{0:d2}' -f $topicOrder
      order = $topicOrder
      categoryOrder = $currentCategory.order
      sourceNumber = $sourceNumber
      title = $parts.Vietnamese
      titleEnglish = $parts.English
      cards = [Collections.Generic.List[object]]::new()
    }
    $currentCategory.topics.Add($currentTopic)
    continue
  }

  if (-not $currentTopic -or $line -match '^3000 TỪ VỰNG') { continue }
  $sourceOrder += 1
  $card = Parse-Card $line $sourceOrder
  if ($card) {
    $currentTopic.cards.Add($card)
  } else {
    $unparsed.Add([ordered]@{ topicId = $currentTopic.id; topic = $currentTopic.title; text = $line })
  }
}

$parsedBeforeDedup = (@($categories | ForEach-Object { $_.topics } | ForEach-Object { $_.cards }).Count)
$duplicatesRemoved = 0
foreach ($topic in @($categories | ForEach-Object { $_.topics })) {
  $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
  $uniqueCards = [Collections.Generic.List[object]]::new()
  foreach ($card in @($topic.cards)) {
    $key = "$($card.term)|$($card.meaning)"
    if ($seen.Add($key)) { $uniqueCards.Add($card) } else { $duplicatesRemoved += 1 }
  }
  $topic.cards = @($uniqueCards)
}

$categoriesWithCards = @($categories | ForEach-Object {
  $_.topics = @($_.topics | Where-Object { $_.cards.Count -gt 0 })
  $_
} | Where-Object { $_.topics.Count -gt 0 })

$allTopics = @($categoriesWithCards | ForEach-Object topics)
$wordCount = ($allTopics | ForEach-Object { $_.cards.Count } | Measure-Object -Sum).Sum
$dataset = [ordered]@{
  id = 'en-vi-word-topics-v1'
  title = '3000 từ tiếng Anh theo chủ đề'
  sourceFile = [IO.Path]::GetFileName($resolvedSource)
  categoryCount = $categoriesWithCards.Count
  topicCount = $allTopics.Count
  wordCount = $wordCount
  categories = $categoriesWithCards
}
$audit = [ordered]@{
  sourceFile = $resolvedSource
  nonEmptyLineCount = $lines.Count
  categoryCount = $categoriesWithCards.Count
  topicCount = $allTopics.Count
  parsedEntryCount = $parsedBeforeDedup
  duplicateEntriesRemoved = $duplicatesRemoved
  finalWordCount = $wordCount
  unparsedLineCount = $unparsed.Count
  unparsedLines = $unparsed
  topics = @($allTopics | ForEach-Object { [ordered]@{ id = $_.id; order = $_.order; categoryOrder = $_.categoryOrder; title = $_.title; sourceNumber = $_.sourceNumber; wordCount = $_.cards.Count } })
}

$outputPath = [IO.Path]::GetFullPath($OutputJson)
$auditPath = [IO.Path]::GetFullPath($AuditJson)
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($outputPath)) | Out-Null
[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($auditPath)) | Out-Null
[IO.File]::WriteAllText($outputPath, ($dataset | ConvertTo-Json -Depth 12 -Compress), [Text.UTF8Encoding]::new($false))
[IO.File]::WriteAllText($auditPath, ($audit | ConvertTo-Json -Depth 8), [Text.UTF8Encoding]::new($false))

[PSCustomObject]@{
  Categories = $categoriesWithCards.Count
  Topics = $allTopics.Count
  ParsedWords = $wordCount
  DuplicatesRemoved = $duplicatesRemoved
  UnparsedLines = $unparsed.Count
  Output = $outputPath
  Audit = $auditPath
} | Format-List

if ($wordCount -lt 2500) { throw "Chỉ phân tích được $wordCount mục từ; cần rà lại quy tắc parser." }
