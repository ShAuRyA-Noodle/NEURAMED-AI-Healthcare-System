import numpy as np
from ml import dicom_io


def _make_dicom(tmp_path, spacing=("0.2", "0.2"), photometric="MONOCHROME2"):
    import pydicom
    from pydicom.dataset import FileDataset, FileMetaDataset
    meta = FileMetaDataset()
    meta.MediaStorageSOPClassUID = pydicom.uid.SecondaryCaptureImageStorage
    meta.MediaStorageSOPInstanceUID = pydicom.uid.generate_uid()
    meta.TransferSyntaxUID = pydicom.uid.ExplicitVRLittleEndian
    ds = FileDataset(str(tmp_path / "t.dcm"), {}, file_meta=meta, preamble=b"\0" * 128)
    ds.Rows, ds.Columns = 16, 16
    ds.PhotometricInterpretation = photometric
    ds.SamplesPerPixel = 1
    ds.BitsAllocated = 16
    ds.BitsStored = 16
    ds.HighBit = 15
    ds.PixelRepresentation = 0
    if spacing:
        ds.PixelSpacing = list(spacing)
    ds.PixelData = (np.arange(256, dtype="uint16")).tobytes()
    path = tmp_path / "t.dcm"
    ds.save_as(str(path), write_like_original=False)
    return str(path)


def test_reads_pixel_spacing(tmp_path):
    p = _make_dicom(tmp_path, spacing=("0.2", "0.2"))
    img, meta = dicom_io.read_dicom(open(p, "rb").read())
    assert meta["pixel_spacing_mm"] == [0.2, 0.2]
    assert meta["measurements_enabled"] is True
    assert img.ndim == 2


def test_missing_spacing_disables_measurements(tmp_path):
    p = _make_dicom(tmp_path, spacing=None)
    _img, meta = dicom_io.read_dicom(open(p, "rb").read())
    assert meta["pixel_spacing_mm"] is None
    assert meta["measurements_enabled"] is False


def test_png_bytes_have_no_spacing():
    meta = dicom_io.metadata_for_raster_image()
    assert meta["pixel_spacing_mm"] is None
    assert meta["measurements_enabled"] is False


def test_is_dicom_detects_magic():
    assert dicom_io.is_dicom(b"\0" * 128 + b"DICM" + b"....")
    assert not dicom_io.is_dicom(b"\x89PNG\r\n")
