"""Compatibility entry point for the current native NPC rig.

The default rebuilds all nine NPCs. --include-player explicitly also rebuilds
player A/B/C; approved player files are otherwise never touched.
"""
import argparse
import json
from npc_walk_rig import ROOT, IDS, DIRECTIONS, rig_npc, gallery
from player_walk_rig import rig_player

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--include-player', action='store_true')
    args = parser.parse_args()
    path = ROOT / 'docs/character-rig-measurements.json'
    report = json.loads(path.read_text())
    for id in IDS:
        report[id] = {direction: rig_npc(id, direction) for direction in DIRECTIONS}
    if args.include_player:
        report['player'] = {direction: rig_player(direction, (1, 2, 3)) for direction in DIRECTIONS}
    path.write_text(json.dumps(report, indent=2) + '\n')
    gallery()
    print('Rebuilt 108 NPC frames from unchanged directional idles.')
