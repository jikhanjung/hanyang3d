"""Check date guards and resumption without network access or real archive writes."""
import json
import tempfile
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch
import run_scheduled_aks as job

class Before(datetime):
    @classmethod
    def now(cls,tz=None):return cls(2026,9,19,22,tzinfo=tz)
class After(datetime):
    @classmethod
    def now(cls,tz=None):return cls(2026,9,22,10,tzinfo=tz)

class ScheduleTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name);self.state=self.root/'state';(self.root/'docs').mkdir()
        for name,value in [('ROOT',self.root),('STATE',self.state)]:
            p=patch.object(job,name,value);p.start();self.addCleanup(p.stop)
        p=patch('sys.argv',['run_scheduled_aks.py','objects']);p.start();self.addCleanup(p.stop)
        self.manifest=self.root/'docs/aks_objects_manifest.json'
    def seed(self,statuses):
        self.manifest.write_text(json.dumps({'models':[{'categories':['물품'],'status':s} for s in statuses]}))
    def state_data(self):return json.loads((self.state/'objects.json').read_text())
    def test_not_due_does_not_download_or_write(self):
        with patch.object(job,'datetime',Before),patch.object(job.subprocess,'run') as run:
            job.main();run.assert_not_called();self.assertFalse(self.state.exists())
    def test_partial_download_is_backed_up_and_not_retried_on_boot(self):
        self.seed(['verified','failed'])
        with patch.object(job,'datetime',After),patch.object(job.subprocess,'run') as run:
            run.return_value.returncode=1;job.main();self.assertEqual(run.call_count,2)
            self.assertEqual(self.state_data()['status'],'complete_with_failures')
            run.reset_mock();job.main();run.assert_not_called()
    def test_interrupted_download_does_not_claim_completion(self):
        self.seed(['catalogued_not_downloaded'])
        with patch.object(job,'datetime',After),patch.object(job.subprocess,'run') as run:
            run.return_value.returncode=1
            with self.assertRaises(RuntimeError):job.main()
            self.assertEqual(run.call_count,1);self.assertNotIn('completed_at',self.state_data())
    def test_nas_retry_does_not_redownload(self):
        self.seed(['verified'])
        with patch.object(job,'datetime',After),patch.object(job.subprocess,'run') as run:
            from types import SimpleNamespace
            run.side_effect=[SimpleNamespace(returncode=0),RuntimeError('NAS offline')]
            with self.assertRaises(RuntimeError):job.main()
            self.assertTrue(self.state_data()['download_finished'])
            run.reset_mock();run.side_effect=None;run.return_value.returncode=0
            job.main();self.assertEqual(run.call_count,1)
            self.assertTrue(self.state_data()['nas_verified'])

if __name__=='__main__':unittest.main()
