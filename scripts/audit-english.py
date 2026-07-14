#!/usr/bin/env python3
"""English text audit for blog articles."""
import re
import os
import sys
import subprocess

# Use a basic list of common English typos / doubled words
DOUBLED = re.compile(r'\b(\w+)\s+\1\b', re.IGNORECASE)
COMMON_TYPOS = {
    r'\bteh\b': 'teh -> the',
    r'\bhte\b': 'hte -> the',
    r'\badn\b': 'adn -> and',
    r'\btaht\b': 'taht -> that',
    r'\bwhcih\b': 'whcih -> which',
    r'\bwhith\b': 'whith -> with',
    r'\brecieve\b': 'recieve -> receive',
    r'\bseperate\b': 'seperate -> separate',
    r'\boccured\b': 'occured -> occurred',
    r'\buntill\b': 'untill -> until',
    r'\bwich\b': 'wich -> which (in some contexts)',
    r'\bteh\b': 'teh -> the',
    r'\bcomming\b': 'comming -> coming',
    r'\bgeting\b': 'geting -> getting',
    r'\bbegining\b': 'begining -> beginning',
    r'\brealise\b': 'British OK',
    r'\bgoverment\b': 'goverment -> government',
    r'\breciept\b': 'reciept -> receipt',
    r'\bdefinately\b': 'definately -> definitely',
    r'\boccassion\b': 'occassion -> occasion',
    r'\bneccessary\b': 'neccessary -> necessary',
    r'\bpriviledge\b': 'priviledge -> privilege',
    r'\brecommend\b': 'ok',
    r'\btruely\b': 'truely -> truly',
    r'\busefull\b': 'usefull -> useful',
    r'\busefull\b': 'usefull -> useful',
    r'\bwich\b': 'wich -> which',
    r'\bmaintainence\b': 'maintainence -> maintenance',
    r'\bexsist\b': 'exsist -> exist',
    r'\bexsisting\b': 'exsisting -> existing',
    r'\baccross\b': 'accross -> across',
    r'\bacheive\b': 'acheive -> achieve',
    r'\bbegining\b': 'begining -> beginning',
    r'\bcatagory\b': 'catagory -> category',
    r'\bcomming\b': 'comming -> coming',
    r'\bconcious\b': 'concious -> conscious',
    r'\bdefinately\b': 'definately -> definitely',
    r'\bdurring\b': 'durring -> during',
    r'\bexistance\b': 'existance -> existence',
    r'\bforseeable\b': 'forseeable -> foreseeable',
    r'\bgovermental\b': 'govermental -> governmental',
    r'\bguage\b': 'guage -> gauge',
    r'\bharras\b': 'harras -> harass',
    r'\bharrasment\b': 'harrasment -> harassment',
    r'\binterupt\b': 'interupt -> interrupt',
    r'\bliason\b': 'liason -> liaison',
    r'\bmanagment\b': 'managment -> management',
    r'\bneccessary\b': 'neccessary -> necessary',
    r'\bnecesary\b': 'necesary -> necessary',
    r'\bnoticable\b': 'noticable -> noticeable',
    r'\boccassion\b': 'occassion -> occasion',
    r'\boccurance\b': 'occurance -> occurrence',
    r'\boccurence\b': 'occurence -> occurrence',
    r'\boptomistic\b': 'optomistic -> optimistic',
    r'\bparalell\b': 'paralell -> parallel',
    r'\bparralel\b': 'parralel -> parallel',
    r'\bpersistant\b': 'persistant -> persistent',
    r'\bposession\b': 'posession -> possession',
    r'\bprefered\b': 'prefered -> preferred',
    r'\bprefering\b': 'prefering -> preferring',
    r'\bpriviledge\b': 'priviledge -> privilege',
    r'\bpublically\b': 'publically -> publicly',
    r'\bpumkin\b': 'pumkin -> pumpkin',
    r'\brecieve\b': 'recieve -> receive',
    r'\breferal\b': 'referal -> referral',
    r'\brelevent\b': 'relevent -> relevant',
    r'\breligous\b': 'religous -> religious',
    r'\bremaintainence\b': 'remaintainence -> remaintenance',
    r'\breprtoire\b': 'reprtoire -> repertoire',
    r'\brequirment\b': 'requirment -> requirement',
    r'\brequivalent\b': 'ok',
    r'\bresturant\b': 'resturant -> restaurant',
    r'\brythm\b': 'rythm -> rhythm',
    r'\bsacrafice\b': 'sacrafice -> sacrifice',
    r'\bsaftey\b': 'saftey -> safety',
    r'\bseperate\b': 'seperate -> separate',
    r'\bseperately\b': 'seperately -> separately',
    r'\bseperation\b': 'seperation -> separation',
    r'\bseperator\b': 'seperator -> separator',
    r'\bseriousely\b': 'seriousely -> seriously',
    r'\bsignficant\b': 'signficant -> significant',
    r'\bsimiliar\b': 'similiar -> similar',
    r'\bsimply\b': 'ok',
    r'\bsincereally\b': 'sincereally -> sincerely',
    r'\bsoldeir\b': 'soldeir -> soldier',
    r'\bsolealy\b': 'solealy -> solely',
    r'\bsophmore\b': 'sophmore -> sophomore',
    r'\bsterotypes\b': 'sterotypes -> stereotypes',
    r'\bstratagy\b': 'stratagy -> strategy',
    r'\bstrenghen\b': 'strenghen -> strengthen',
    r'\bstrenous\b': 'strenous -> strenuous',
    r'\bstubborness\b': 'stubborness -> stubbornness',
    r'\bstumach\b': 'stumach -> stomach',
    r'\bsuceed\b': 'suceed -> succeed',
    r'\bsucess\b': 'sucess -> success',
    r'\bsucessful\b': 'sucessful -> successful',
    r'\bsuficient\b': 'suficient -> sufficient',
    r'\bsupercede\b': 'supercede -> supersede',
    r'\bsuprise\b': 'suprise -> surprise',
    r'\bthreshhold\b': 'threshhold -> threshold',
    r'\bthroughly\b': 'throughly -> thoroughly',
    r'\btruely\b': 'truely -> truly',
    r'\btyrany\b': 'tyrany -> tyranny',
    r'\btyrany\b': 'tyrany -> tyranny',
    r'\btyrany\b': 'tyrany -> tyranny',
    r'\bunderate\b': 'underate -> underrate',
    r'\busefull\b': 'usefull -> useful',
    r'\busualy\b': 'usualy -> usually',
    r'\bvaccum\b': 'vaccum -> vacuum',
    r'\bvegtable\b': 'vegtable -> vegetable',
    r'\bvehical\b': 'vehical -> vehicle',
    r'\bvengance\b': 'vengance -> vengeance',
    r'\bvertue\b': 'vertue -> virtue',
    r'\bvisable\b': 'visable -> visible',
    r'\bwanderful\b': 'wanderful -> wonderful',
    r'\bweakely\b': 'weakely -> weakly',
    r'\bweeny\b': 'weeny -> teeny',
    r'\bwhereever\b': 'whereever -> wherever',
    r'\bwich\b': 'wich -> which',
    r'\bwidly\b': 'widly -> widely',
    r'\bwithing\b': 'withing -> within',
    r'\bwitnessd\b': 'witnessd -> witnessed',
    r'\bwnat\b': 'wnat -> want',
    r'\bwoh\b': 'woh -> who',
    r'\bworthwhile\b': 'ok',
    r'\byatch\b': 'yatch -> yacht',
    r'\byatch\b': 'yatch -> yacht',
    r'\byness\b': 'yness -> -ness',
    r'\bzeebra\b': 'zeebra -> zebra',
    r'\bzuchini\b': 'zuchini -> zucchini',
    r'\bbehaviour\b': 'British OK',
    r'\bcolour\b': 'British OK',
    r'\bcentre\b': 'British OK',
    r'\bdefence\b': 'British OK',
    r'\bhonour\b': 'British OK',
    r'\bneighbour\b': 'neighbour -> neighbor',
    r'\btravelled\b': 'British OK',
    r'\bprogramme\b': 'British OK (in some contexts)',
    r'\bcancelled\b': 'British OK (and US is fine too)',
    r'\btravelling\b': 'British OK',
    r'\bmetre\b': 'British OK',
    r'\blitre\b': 'British OK',
    r'\bdefinitely\b': 'ok',
    r'\boverall\b': 'ok',
    r'\bconsensus\b': 'ok',
    r'\bsuccessfully\b': 'ok',
    r'\bconsensus\b': 'ok',
    r'\bseparate\b': 'ok',
}

# Skip lines that are clearly code or links
def line_ok(line: str, in_code: bool) -> bool:
    if in_code:
        return False
    if line.lstrip().startswith(('import ', 'export ', 'const ', 'let ', 'var ', 'function ', 'class ', '//', '/*', '*', '#', '|', '>', '`', 'http', '---', '```')):
        return False
    return True

issues = []
for root, _, files in os.walk('src/content/blog'):
    for f in files:
        if not f.endswith('.mdx'):
            continue
        path = os.path.join(root, f)
        with open(path) as fh:
            in_code = False
            in_frontmatter = False
            line_count = 0
            for ln, line in enumerate(fh, 1):
                line_count += 1
                stripped = line.strip()
                if line_count == 1 and stripped == '---':
                    in_frontmatter = True
                    continue
                if in_frontmatter:
                    if stripped == '---':
                        in_frontmatter = False
                    continue
                if stripped.startswith('```'):
                    in_code = not in_code
                    continue
                if not line_ok(line, in_code):
                    continue
                # Check doubled words
                for m in DOUBLED.finditer(line):
                    word = m.group(1)
                    # Skip common 1-letter or legit phrases
                    if word.lower() in ('a', 'i', 'the', 'to', 'in', 'of', 'is', 'it', 'be', 'as', 'or', 'on', 'an', 'at', 'so', 'do'):
                        continue
                    issues.append((path, ln, f'doubled word: "{word}"', line.strip()[:120], m.group(0)))
                # Check known typos
                for pat, fix in COMMON_TYPOS.items():
                    for m in re.finditer(pat, line, re.IGNORECASE):
                        issues.append((path, ln, fix, line.strip()[:120], m.group(0)))

if not issues:
    print('OK: no English typos found by automated check')
    sys.exit(0)

print(f'Found {len(issues)} potential English issues:')
for path, ln, kind, line, snippet in issues[:50]:
    print(f'  {path}:{ln}  [{kind}]  {line}')
