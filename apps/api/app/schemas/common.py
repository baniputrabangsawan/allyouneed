from pydantic import BaseModel, ConfigDict


class ApiModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=lambda field: "".join(
            [field.split("_")[0], *[part.title() for part in field.split("_")[1:]]]
        ),
        populate_by_name=True,
    )


class DataResponse[T](ApiModel):
    data: T
