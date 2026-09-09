"""Numerical checks using synthetic points, never historical evidence."""
import unittest
import numpy as np
from fit_pixel_affine import fit


def sample():
    rows = []
    for i, (x, y) in enumerate([(0, 0), (100, 0), (0, 100), (100, 100), (25, 25), (75, 65)]):
        rows.append(dict(point_id=str(i), source_asset_id='source', target_asset_id='target',
                         source_x=x, source_y=y, target_x=2*x + .2*y + 8,
                         target_y=-.1*x + 1.5*y + 12,
                         role='control' if i < 4 else 'check', status='accepted',
                         evidence_note='Synthetic numerical fixture'))
    return rows


class FitTests(unittest.TestCase):
    def test_recover_known_transform(self):
        result = fit(sample(), 1)
        np.testing.assert_allclose(result['matrix_source_to_target'],
                                   [[2, .2, 8], [-.1, 1.5, 12], [0, 0, 1]], atol=1e-10)
        self.assertTrue(result['within_pixel_tolerance'])
        self.assertIsNone(result['geographic_crs'])

    def test_checks_are_not_used_to_fit(self):
        rows = sample()
        rows[-1]['target_x'] += 20
        result = fit(rows, 5)
        self.assertLess(result['metrics']['control']['rmse_px'], 1e-10)
        self.assertAlmostEqual(result['metrics']['check']['rmse_px'], 20 / np.sqrt(2))
        self.assertFalse(result['within_pixel_tolerance'])

    def test_no_fit_without_independent_evidence(self):
        for mutation in ('proposed', 'collinear', 'duplicate', 'nonfinite', 'no_note'):
            with self.subTest(mutation=mutation):
                rows = sample()
                if mutation == 'proposed':
                    rows[-1]['status'] = 'proposed'
                elif mutation == 'collinear':
                    for i, p in enumerate(rows[:4]):
                        p['source_x'] = p['source_y'] = i * 10
                elif mutation == 'duplicate':
                    rows[-1]['source_x'] = rows[0]['source_x']
                    rows[-1]['source_y'] = rows[0]['source_y']
                elif mutation == 'nonfinite':
                    rows[-1]['target_x'] = float('nan')
                else:
                    rows[0]['evidence_note'] = ''
                with self.assertRaises(ValueError):
                    fit(rows, 5)


if __name__ == '__main__':
    unittest.main()
