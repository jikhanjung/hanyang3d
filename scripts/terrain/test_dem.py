"""Checks for elevation decoding and generated source coverage."""
import json
import unittest
from pathlib import Path

import numpy as np

from build_dem import decode


class ElevationTests(unittest.TestCase):
    def test_terrarium_signed_metres_and_fraction(self):
        pixels=np.array([[[128,0,0],[127,255,128],[129,1,64]]],dtype=np.uint8)
        np.testing.assert_array_equal(decode(pixels),[[0,-0.5,257.25]])

    def test_local_grid_coverage_and_checksum(self):
        import hashlib
        root=Path(__file__).resolve().parents[2]
        manifest=json.loads((root/'gis/control_points/seoul_terrain_manifest.json').read_text())
        output=root/manifest['output']
        self.assertEqual(hashlib.sha256(output.read_bytes()).hexdigest(),manifest['output_sha256'])
        grid=json.loads(output.read_text())
        values=np.array(grid['elevations'])
        self.assertEqual(values.size,grid['size']**2)
        self.assertTrue(np.isfinite(values).all())
        self.assertGreater(values.max()-values.min(),200)
        for tile in manifest['tiles']:
            self.assertEqual(hashlib.sha256((root/tile['path']).read_bytes()).hexdigest(),tile['sha256'])


if __name__=='__main__':
    unittest.main()
